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
    
    ckpt_bid_path = "checkpoints/auction_optimal_bid.pt"
    ckpt_swap_path = "checkpoints/auction_optimal_swap.pt"
    if os.path.exists(ckpt_bid_path):
        net_bid.load_state_dict(torch.load(ckpt_bid_path, map_location=device, weights_only=True))
        print(f"Resumed bid net from {ckpt_bid_path}")
    if os.path.exists(ckpt_swap_path):
        net_swap.load_state_dict(torch.load(ckpt_swap_path, map_location=device, weights_only=True))
        print(f"Resumed swap net from {ckpt_swap_path}")
        
    optimizer_bid = torch.optim.Adam(net_bid.parameters(), lr=args.lr)
    optimizer_swap = torch.optim.Adam(net_swap.parameters(), lr=args.lr)
    
    os.makedirs("checkpoints", exist_ok=True)
    
    max_iters = 2 if args.smoke_test else 1000000
    
    for it in range(max_iters):
        traj_bid, traj_swap = runner.collect(net_bid, net_swap, args.n_steps)
        
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
            
            loss_val_bid = 0.0
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
            loss_val_swap = 0.0
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
                    
        # Total returns from both bid and swap trajectories (or rather per seat)
        # We can just sum them up for display.
        all_trajs = traj_bid + traj_swap
        avg_ret = np.mean([np.sum([s['reward'] for s in t]) for t in all_trajs]) if all_trajs else 0.0
        
        print(f"Iter {it} | Loss (Bid): {loss_val_bid if 'loss_val_bid' in locals() else 0.0:.4f} | Loss (Swap): {loss_val_swap if 'loss_val_swap' in locals() else 0.0:.4f} | Avg Return: {avg_ret:.2f}")
        
        if it > 0 and it % 250 == 0:
            torch.save(net_bid.state_dict(), ckpt_bid_path)
            torch.save(net_swap.state_dict(), ckpt_swap_path)
            
        if not args.smoke_test and it > 0 and it % 100 == 0:
            if check_convergence(net_bid, env_factory, device, avg_return=avg_ret, is_candidate=False):
                print("Converged!")
                break
                
    torch.save(net_bid.state_dict(), "checkpoints/auction_optimal_bid.pt")
    torch.save(net_swap.state_dict(), "checkpoints/auction_optimal_swap.pt")
    print("Saved checkpoints/auction_optimal.pt")

if __name__ == "__main__":
    main()
