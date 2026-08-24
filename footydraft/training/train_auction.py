import torch
import numpy as np
import argparse
import os

from footydraft_sim.env_auction import AuctionEnv, BIDDING_OBS_LEN, N_BIDDING_ACTIONS
from footydraft_sim.players import load_pool
from footydraft_sim.observation import CONTEXT_LEN, CANDIDATE_FEATURE_LEN
from rl.networks import DiscreteHead, CandidateScorer
from rl.vec_runners import AuctionRunner
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
        return AuctionEnv(pool)
        
    envs = [env_factory() for _ in range(args.n_envs)]
    rng = np.random.default_rng(42)
    runner = AuctionRunner(envs, device, rng)
    
    net_bid = DiscreteHead(BIDDING_OBS_LEN, N_BIDDING_ACTIONS).to(device)
    net_swap = CandidateScorer(CONTEXT_LEN, CANDIDATE_FEATURE_LEN).to(device)
    
    optimizer_bid = torch.optim.Adam(net_bid.parameters(), lr=args.lr)
    optimizer_swap = torch.optim.Adam(net_swap.parameters(), lr=args.lr)
    
    os.makedirs("checkpoints", exist_ok=True)
    ckpt_bid_path = "checkpoints/auction_optimal_bid.pt"
    ckpt_swap_path = "checkpoints/auction_optimal_swap.pt"
    start_it = 0

    if os.path.exists(ckpt_bid_path):
        try:
            ckpt_b = torch.load(ckpt_bid_path, map_location=device, weights_only=False)
            if isinstance(ckpt_b, dict) and "model_state_dict" in ckpt_b:
                net_bid.load_state_dict(ckpt_b["model_state_dict"])
                optimizer_bid.load_state_dict(ckpt_b["optimizer_state_dict"])
                start_it = ckpt_b.get("iteration", 0) + 1
                print(f"Resumed bid net from {ckpt_bid_path} at iteration {start_it}")
            elif isinstance(ckpt_b, dict):
                net_bid.load_state_dict(ckpt_b)
                print(f"Loaded bid model weights from {ckpt_bid_path}")
        except Exception as e:
            print(f"Notice: Could not load existing bid checkpoint ({e}). Starting fresh.")

    if os.path.exists(ckpt_swap_path):
        try:
            ckpt_s = torch.load(ckpt_swap_path, map_location=device, weights_only=False)
            if isinstance(ckpt_s, dict) and "model_state_dict" in ckpt_s:
                net_swap.load_state_dict(ckpt_s["model_state_dict"])
                optimizer_swap.load_state_dict(ckpt_s["optimizer_state_dict"])
                print(f"Resumed swap net from {ckpt_swap_path}")
            elif isinstance(ckpt_s, dict):
                net_swap.load_state_dict(ckpt_s)
                print(f"Loaded swap model weights from {ckpt_swap_path}")
        except Exception as e:
            print(f"Notice: Could not load existing swap checkpoint ({e}). Starting fresh.")
    
    max_iters = 2 if args.smoke_test else args.max_iters
    min_iters = 0 if args.smoke_test else args.min_iters
    check_interval = 1 if args.smoke_test else args.check_interval
    
    try:
        for it in range(start_it, max_iters):
            traj_bid, traj_swap = runner.collect(net_bid, net_swap, args.n_steps)
            
            loss_val_bid = 0.0
            loss_val_swap = 0.0

            # Bidding Phase Optimization
            all_obs, all_masks = [], []
            all_actions, all_log_probs, all_returns, all_advantages = [], [], [], []
            
            for traj in traj_bid:
                rewards = np.array([step["reward"] for step in traj], dtype=np.float32)
                values = np.array([step["value"] for step in traj], dtype=np.float32)
                adv, ret = compute_gae(rewards, values)
                
                for i, step in enumerate(traj):
                    all_obs.append(step["features"])
                    all_masks.append(step["mask"])
                    all_actions.append(step["action"])
                    all_log_probs.append(step["log_prob"])
                    all_returns.append(ret[i])
                    all_advantages.append(adv[i])
                    
            if len(all_returns) > 0:
                adv_tensor = torch.tensor(np.array(all_advantages), dtype=torch.float32, device=device)
                adv_tensor = (adv_tensor - adv_tensor.mean()) / (adv_tensor.std() + 1e-8)
                ret_tensor = torch.tensor(np.array(all_returns), dtype=torch.float32, device=device)
                act_tensor = torch.tensor(np.array(all_actions), dtype=torch.int64, device=device)
                logp_tensor = torch.tensor(np.array(all_log_probs), dtype=torch.float32, device=device)
                obs_tensor = torch.tensor(np.array(all_obs), dtype=torch.float32, device=device)
                mask_tensor = torch.tensor(np.array(all_masks), dtype=torch.bool, device=device)
                
                n_samples = len(all_returns)
                inds = np.arange(n_samples)
                
                for _ in range(args.epochs):
                    np.random.shuffle(inds)
                    for start in range(0, n_samples, args.batch_size):
                        end = start + args.batch_size
                        b_inds = inds[start:end]
                        logits, values = net_bid(obs_tensor[b_inds], mask_tensor[b_inds])
                        loss, stats = ppo_loss(logits, values, act_tensor[b_inds], logp_tensor[b_inds], adv_tensor[b_inds], ret_tensor[b_inds])
                        optimizer_bid.zero_grad()
                        loss.backward()
                        torch.nn.utils.clip_grad_norm_(net_bid.parameters(), 0.5)
                        optimizer_bid.step()
                        loss_val_bid = loss.item()
                        
            # Swap Phase Optimization
            all_contexts, all_feats, all_masks = [], [], []
            all_actions, all_log_probs, all_returns, all_advantages = [], [], [], []
            
            for traj in traj_swap:
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
                    
            if len(all_returns) > 0:
                adv_tensor = torch.tensor(np.array(all_advantages), dtype=torch.float32, device=device)
                adv_tensor = (adv_tensor - adv_tensor.mean()) / (adv_tensor.std() + 1e-8)
                ret_tensor = torch.tensor(np.array(all_returns), dtype=torch.float32, device=device)
                act_tensor = torch.tensor(np.array(all_actions), dtype=torch.int64, device=device)
                logp_tensor = torch.tensor(np.array(all_log_probs), dtype=torch.float32, device=device)
                ctx_tensor = torch.tensor(np.array(all_contexts), dtype=torch.float32, device=device)
                feats_tensor, mask_tensor = pad_candidates(all_feats, feature_len=all_feats[0].shape[1] if len(all_feats[0])>0 else 1, device=device)
                
                n_samples = len(all_returns)
                inds = np.arange(n_samples)
                for _ in range(args.epochs):
                    np.random.shuffle(inds)
                    for start in range(0, n_samples, args.batch_size):
                        end = start + args.batch_size
                        b_inds = inds[start:end]
                        logits, values = net_swap(ctx_tensor[b_inds], feats_tensor[b_inds], mask_tensor[b_inds])
                        loss, stats = ppo_loss(logits, values, act_tensor[b_inds], logp_tensor[b_inds], adv_tensor[b_inds], ret_tensor[b_inds])
                        optimizer_swap.zero_grad()
                        loss.backward()
                        torch.nn.utils.clip_grad_norm_(net_swap.parameters(), 0.5)
                        optimizer_swap.step()
                        loss_val_swap = loss.item()
                        
            # Total returns from bidding trajectories (every completed game has a bidding trajectory)
            avg_ret = np.mean([np.sum([s['reward'] for s in t]) for t in traj_bid]) if traj_bid else 0.0
            
            print(f"Iter {it} | Loss (Bid): {loss_val_bid:.4f} | Loss (Swap): {loss_val_swap:.4f} | Avg Return: {avg_ret:.2f}")
            
            if it > 0 and it % args.save_interval == 0:
                torch.save({
                    "iteration": it,
                    "model_state_dict": net_bid.state_dict(),
                    "optimizer_state_dict": optimizer_bid.state_dict(),
                }, ckpt_bid_path)
                torch.save({
                    "iteration": it,
                    "model_state_dict": net_swap.state_dict(),
                    "optimizer_state_dict": optimizer_swap.state_dict(),
                }, ckpt_swap_path)
                
            if not args.smoke_test and it >= min_iters and it % check_interval == 0:
                if check_convergence(net_bid, env_factory, device, is_candidate=False):
                    print("Converged to optimal play with 99% certainty!")
                    break
    except KeyboardInterrupt:
        print("\nTraining interrupted by user. Saving current checkpoints...")

    torch.save(net_bid.state_dict(), ckpt_bid_path)
    torch.save(net_swap.state_dict(), ckpt_swap_path)
    print(f"Saved {ckpt_bid_path} and {ckpt_swap_path}")

if __name__ == "__main__":
    main()

