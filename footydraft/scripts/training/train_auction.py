import time
import json
import torch
from env_auction import BatchedAuctionEnv
from models import AuctionPolicyNetwork
from scripted_auction import ScriptedBidder
from ppo import PPO
from config import get_live_config, METRICS_DIR, EXPORT_DIR, CHECKPOINTS_DIR
from export_weights import export_model_to_json

BATCH_SIZE = 8192
STEPS_PER_UPDATE = 64           # rollout horizon T
CHECKPOINT_EVERY = 50           # save weights every N updates
STATUS_FILE = METRICS_DIR / "auction_status.json"


def benchmark(env, device):
    steps = 50
    t0 = time.time()
    for _ in range(steps):
        actions = torch.randint(0, 4, size=(BATCH_SIZE, 5), device=device)
        env.step(actions)
    if device.type == "cuda":
        torch.cuda.synchronize()
    dur = time.time() - t0
    # Estimate completed drafts: steps * BATCH_SIZE / ~75 steps-per-draft
    drafts_per_sec = (steps * BATCH_SIZE) / 75.0 / dur
    return drafts_per_sec


def collect_rollout(env, model, device, reward_scale=0.01):
    obs_buf, act_buf, lp_buf, rew_buf, mask_buf, val_buf = [], [], [], [], [], []

    obs = env.get_obs()
    masks = env.get_legal_actions()

    for _ in range(STEPS_PER_UPDATE):
        with torch.no_grad():
            flat_obs   = obs.reshape(-1, 69)
            flat_masks = masks.reshape(-1, 4)
            acts, log_probs, vals = model.sample_action(flat_obs, flat_masks)

        obs_buf.append(flat_obs)
        act_buf.append(acts)
        lp_buf.append(log_probs)
        mask_buf.append(flat_masks)
        val_buf.append(vals)

        obs, rewards, dones, masks = env.step(acts.reshape(BATCH_SIZE, 5))
        scaled_rewards = rewards * reward_scale
        rew_buf.append(scaled_rewards.reshape(-1))

    # Monte-Carlo returns (gamma = 1 per spec)
    returns = torch.zeros_like(rew_buf[-1])
    ret_buf = []
    for r in reversed(rew_buf):
        returns = r + returns
        ret_buf.insert(0, returns.clone())

    advantages = torch.cat(ret_buf) - torch.cat(val_buf)

    return {
        "obs":        torch.cat(obs_buf),
        "masks":      torch.cat(mask_buf),
        "actions":    torch.cat(act_buf),
        "log_probs":  torch.cat(lp_buf),
        "returns":    torch.cat(ret_buf),
        "advantages": advantages,
    }


def train():
    import sys
    # Force line-buffered output so logs appear immediately in background tasks
    sys.stdout.reconfigure(line_buffering=True)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[auction] device: {device}", flush=True)

    # --- env ---
    env = BatchedAuctionEnv(batch_size=BATCH_SIZE, device=device)

    # --- throughput benchmark ---
    print("[auction] benchmarking throughput...")
    tput = benchmark(env, device)
    print(f"[auction] throughput: {tput:.1f} drafts/sec", flush=True)
    if tput < 2000:
        print(f"[auction] Note: target is 2000 drafts/sec (currently {tput:.1f} d/s)", flush=True)

    # --- model + optimizer ---
    config = get_live_config("auction")
    model  = AuctionPolicyNetwork(obs_dim=69).to(device)
    ppo    = PPO(model, config)

    history_file = METRICS_DIR / "auction_history.json"
    history = []
    update = 0
    t_start = time.time()

    if history_file.exists():
        try:
            with open(history_file, "r", encoding="utf-8") as f:
                history = json.load(f)
            if history:
                last_item = history[-1]
                update = last_item.get("update", 0)
                t_start = time.time() - last_item.get("elapsed_s", 0)
                print(f"[auction] continuing from round #{update} ({last_item.get('elapsed_s', 0):.0f}s elapsed)", flush=True)
        except Exception:
            history = []

    ckpt_path = CHECKPOINTS_DIR / "auction" / "champion.pt"
    if ckpt_path.exists():
        try:
            data = torch.load(ckpt_path, map_location=device)
            model.load_state_dict(data["state_dict"])
            print(f"[auction] loaded champion model weights from {ckpt_path}", flush=True)
        except Exception as e:
            print(f"[auction] checkpoint load note: {e}", flush=True)

    print("[auction] training started — Ctrl-C to stop", flush=True)

    while True:
        # Hot-reload hyperparams every update (for live_config.json edits)
        new_cfg = get_live_config("auction")
        if new_cfg != config:
            config = new_cfg
            ppo.config = config
            ppo.optimizer.param_groups[0]["lr"] = config["lr"]
            print(f"[auction] live config reloaded: lr={config['lr']} c_entropy={config['c_entropy']} r_scale={config.get('reward_scale', 0.01)}", flush=True)

        reward_scale = config.get("reward_scale", 0.01)
        rollouts = collect_rollout(env, model, device, reward_scale=reward_scale)
        metrics  = ppo.update(rollouts)
        update  += 1

        # --- compute full 11-player projected squad score statistics across active environments ---
        avg_squad_score = env.get_avg_squad_score()

        elapsed = time.time() - t_start

        # --- write metrics ---
        status = {
            "update":          update,
            "elapsed_s":       round(elapsed, 1),
            "throughput":      round(tput, 1),
            "avg_squad_score": round(avg_squad_score, 2),
            "policy_loss":     round(metrics["policy_loss"], 6),
            "value_loss":      round(metrics["value_loss"],  6),
            "entropy":         round(metrics["entropy"],     6),
            "lr":              config["lr"],
            "c_entropy":       config["c_entropy"],
        }
        history.append(status)

        with open(METRICS_DIR / "auction_metrics.json", "w", encoding="utf-8") as f:
            json.dump({**status, "history": history[-200:]}, f, indent=2)
        with open(history_file, "w", encoding="utf-8") as f:
            json.dump(history, f, indent=2)
        with open(STATUS_FILE, "w", encoding="utf-8") as f:
            json.dump(status, f, indent=2)

        if update % 5 == 0:
            print(f"[auction] update={update} "
                  f"score={avg_squad_score:.1f} "
                  f"pl={metrics['policy_loss']:.4f} "
                  f"vl={metrics['value_loss']:.4f} "
                  f"ent={metrics['entropy']:.4f} "
                  f"elapsed={elapsed:.0f}s", flush=True)

        # --- checkpoint every 5 updates ---
        if update % 5 == 0:
            export_model_to_json(model, EXPORT_DIR / "auction_policy.json")
            torch.save({
                "state_dict": model.state_dict(),
                "update": update,
                "draft_count": update * BATCH_SIZE * STEPS_PER_UPDATE // 75,
                "avg_squad_score": avg_squad_score
            }, CHECKPOINTS_DIR / "auction" / "champion.pt")
            print(f"[auction] checkpoint saved at update {update} (score={avg_squad_score:.1f})", flush=True)


if __name__ == "__main__":
    try:
        train()
    except KeyboardInterrupt:
        print("\n[auction] training stopped by user")
