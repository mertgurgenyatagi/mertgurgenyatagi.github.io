import torch
import numpy as np
import argparse
import os

from footydraft_sim.env_deal_or_no_deal import DealOrNoDealEnv, OBS_LEN, N_ACTIONS
from footydraft_sim.players import load_pool
from rl.networks import DiscreteHead
from rl.vec_runners import DiscreteRunner
from rl.ppo_core import compute_gae, ppo_loss
from rl.convergence import check_convergence

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
        return DealOrNoDealEnv(pool)
        
    envs = [env_factory() for _ in range(args.n_envs)]
    rng = np.random.default_rng(42)
    runner = DiscreteRunner(envs, device, rng)
    
    net = DiscreteHead(OBS_LEN, N_ACTIONS).to(device)
    optimizer = torch.optim.Adam(net.parameters(), lr=args.lr)
    
    os.makedirs("checkpoints", exist_ok=True)
    
    max_iters = 2 if args.smoke_test else 1000000
    
    for it in range(max_iters):
        trajectories = runner.collect(net, args.n_steps)
        
        all_obs, all_masks = [], []
        all_actions, all_log_probs, all_returns, all_advantages = [], [], [], []
        
        for traj in trajectories:
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
                
        if len(all_returns) == 0:
            continue
            
        adv_tensor = torch.tensor(np.array(all_advantages), dtype=torch.float32, device=device)
        adv_tensor = (adv_tensor - adv_tensor.mean()) / (adv_tensor.std() + 1e-8)
        
        ret_tensor = torch.tensor(np.array(all_returns), dtype=torch.float32, device=device)
        act_tensor = torch.tensor(np.array(all_actions), dtype=torch.int64, device=device)
        logp_tensor = torch.tensor(np.array(all_log_probs), dtype=torch.float32, device=device)
        
        obs_tensor = torch.tensor(np.array(all_obs), dtype=torch.float32, device=device)
        mask_tensor = torch.tensor(np.array(all_masks), dtype=torch.bool, device=device)
        
        n_samples = len(all_returns)
        inds = np.arange(n_samples)
        
        loss_val = 0.0
        for _ in range(args.epochs):
            np.random.shuffle(inds)
            for start in range(0, n_samples, args.batch_size):
                end = start + args.batch_size
                b_inds = inds[start:end]
                
                logits, values = net(obs_tensor[b_inds], mask_tensor[b_inds])
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
        
        if not args.smoke_test and it > 0 and it % 100 == 0:
            if check_convergence(net, env_factory, device, avg_return=avg_ret, is_candidate=False):
                print("Converged!")
                break
                
    torch.save(net.state_dict(), "checkpoints/deal_or_no_deal_optimal.pt")
    print("Saved checkpoints/deal_or_no_deal_optimal.pt")

if __name__ == "__main__":
    main()
