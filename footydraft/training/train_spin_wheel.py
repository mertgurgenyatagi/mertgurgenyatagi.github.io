import torch
import numpy as np
import argparse
import os

from footydraft_sim.env_spin_wheel import SpinWheelEnv
from footydraft_sim.players import load_pool
from footydraft_sim.observation import CONTEXT_LEN, CANDIDATE_FEATURE_LEN
from rl.networks import CandidateScorer
from rl.vec_runners import CandidateRunner
from rl.ppo_core import compute_gae, ppo_loss
from rl.convergence import check_convergence
from rl.padding import pad_candidates

def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--smoke_test", action="store_true", help="Run a quick smoke test")
    parser.add_argument("--n_envs", type=int, default=32)
    parser.add_argument("--n_steps", type=int, default=2048)
    parser.add_argument("--epochs", type=int, default=4)
    parser.add_argument("--batch_size", type=int, default=256)
    parser.add_argument("--lr", type=float, default=3e-4)
    parser.add_argument("--max_iters", type=int, default=100000)
    parser.add_argument("--min_iters", type=int, default=20000)
    parser.add_argument("--check_interval", type=int, default=2000)
    parser.add_argument("--save_interval", type=int, default=250)
    return parser.parse_args()

def main():
    args = parse_args()
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    
    pool_path = os.path.join(os.path.dirname(__file__), "..", "public", "player_data.csv")
    pool = load_pool(pool_path)
    
    def env_factory():
        return SpinWheelEnv(pool)
        
    envs = [env_factory() for _ in range(args.n_envs)]
    rng = np.random.default_rng(42)
    runner = CandidateRunner(envs, device, rng)
    
    net = CandidateScorer(CONTEXT_LEN, CANDIDATE_FEATURE_LEN).to(device)
    optimizer = torch.optim.Adam(net.parameters(), lr=args.lr)
    
    os.makedirs("checkpoints", exist_ok=True)
    ckpt_path = "checkpoints/spin_wheel_optimal.pt"
    start_it = 0

    if os.path.exists(ckpt_path):
        try:
            ckpt = torch.load(ckpt_path, map_location=device, weights_only=False)
            if isinstance(ckpt, dict) and "model_state_dict" in ckpt:
                net.load_state_dict(ckpt["model_state_dict"])
                optimizer.load_state_dict(ckpt["optimizer_state_dict"])
                start_it = ckpt.get("iteration", 0) + 1
                print(f"Resumed from {ckpt_path} at iteration {start_it}")
            elif isinstance(ckpt, dict):
                net.load_state_dict(ckpt)
                print(f"Loaded model weights from {ckpt_path}")
        except Exception as e:
            print(f"Notice: Could not load existing checkpoint ({e}). Starting fresh.")
    
    max_iters = 2 if args.smoke_test else args.max_iters
    min_iters = 0 if args.smoke_test else args.min_iters
    check_interval = 1 if args.smoke_test else args.check_interval
    
    try:
        for it in range(start_it, max_iters):
            trajectories = runner.collect(net, args.n_steps)
            
            all_contexts, all_feats, all_masks = [], [], []
            all_actions, all_log_probs, all_returns, all_advantages = [], [], [], []
            
            for traj in trajectories:
                rewards = np.array([step["reward"] for step in traj], dtype=np.float32)
                values = np.array([step["value"] for step in traj], dtype=np.float32)
                adv, ret = compute_gae(rewards, values)
                
                for i, step in enumerate(traj):
                    all_contexts.append(step["context"])
                    all_feats.append(step["candidate_features"])
                    all_actions.append(step["action_idx"])
                    all_log_probs.append(step["log_prob"])
                    all_returns.append(ret[i])
                    all_advantages.append(adv[i])
                    
            if len(all_returns) == 0:
                continue
                
            adv_tensor = torch.tensor(np.array(all_advantages), dtype=torch.float32, device=device)
            adv_tensor = (adv_tensor - adv_tensor.mean()) / (adv_tensor.std() + 1e-8)
            
            ret_tensor = torch.tensor(np.array(all_returns), dtype=torch.float32, device=device)
            act_tensor = torch.tensor(np.array(all_actions), dtype=torch.int64, device=device)
            logp_tensor = torch.tensor(np.array(all_log_probs), dtype=torch.float32, device=device)
            
            ctx_tensor = torch.tensor(np.array(all_contexts), dtype=torch.float32, device=device)
            feats_tensor, mask_tensor = pad_candidates(all_feats, feature_len=all_feats[0].shape[1] if len(all_feats[0])>0 else 1, device=device)
            
            n_samples = len(all_returns)
            inds = np.arange(n_samples)
            
            loss_val = 0.0
            for _ in range(args.epochs):
                np.random.shuffle(inds)
                for start in range(0, n_samples, args.batch_size):
                    end = start + args.batch_size
                    b_inds = inds[start:end]
                    
                    logits, values = net(ctx_tensor[b_inds], feats_tensor[b_inds], mask_tensor[b_inds])
                    loss, stats = ppo_loss(
                        logits, values, act_tensor[b_inds], logp_tensor[b_inds],
                        adv_tensor[b_inds], ret_tensor[b_inds]
                    )
                    
                    optimizer.zero_grad()
                    loss.backward()
                    torch.nn.utils.clip_grad_norm_(net.parameters(), 0.5)
                    optimizer.step()
                    loss_val = loss.item()
                    
            avg_ret = np.mean([np.sum([s['reward'] for s in t]) for t in trajectories])
            print(f"Iter {it} | Loss: {loss_val:.4f} | Avg Return: {avg_ret:.2f}")
            
            if it > 0 and it % args.save_interval == 0:
                torch.save({
                    "iteration": it,
                    "model_state_dict": net.state_dict(),
                    "optimizer_state_dict": optimizer.state_dict(),
                }, ckpt_path)
            
            if not args.smoke_test and it >= min_iters and it % check_interval == 0:
                if check_convergence(net, env_factory, device, is_candidate=True):
                    print("Converged to optimal play with 99% certainty!")
                    break
    except KeyboardInterrupt:
        print("\nTraining interrupted by user. Saving current checkpoint...")

    torch.save(net.state_dict(), ckpt_path)
    print(f"Saved {ckpt_path}")

if __name__ == "__main__":
    main()

