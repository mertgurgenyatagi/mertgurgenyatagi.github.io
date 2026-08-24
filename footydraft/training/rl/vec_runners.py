import numpy as np
import torch
from .padding import pad_candidates

class CandidateRunner:
    def __init__(self, envs, device, rng):
        self.envs = envs
        self.device = device
        self.rng = rng
        self.completed = []
        self.trajectories = [{} for _ in envs]
        for i, env in enumerate(self.envs):
            env.reset(self.rng)
            self.trajectories[i] = {s: [] for s in range(env.seat_count)}

    def collect(self, net, n_steps):
        steps = 0
        while steps < n_steps:
            contexts, feats_list, cand_indices = [], [], []
            valid_envs, acting_seats = [], []

            for i, env in enumerate(self.envs):
                seat = env.acting_seat()
                if seat is None:
                    continue
                obs = env.observe(seat)
                contexts.append(obs["context"])
                feats_list.append(obs["candidate_features"])
                cand_indices.append(obs["candidate_indices"])
                valid_envs.append(i)
                acting_seats.append(seat)

            if not valid_envs:
                break

            net.eval()
            with torch.no_grad():
                ctx_t = torch.tensor(np.array(contexts), dtype=torch.float32, device=self.device)
                f_t, m_t = pad_candidates(feats_list, feature_len=feats_list[0].shape[1] if len(feats_list[0]) > 0 else 1, device=self.device)
                logits, values = net(ctx_t, f_t, m_t)
                dist = torch.distributions.Categorical(logits=logits)
                actions = dist.sample()
                log_probs = dist.log_prob(actions)

            actions_np = actions.cpu().numpy()
            log_probs_np = log_probs.cpu().numpy()
            values_np = values.cpu().numpy()

            for k, env_idx in enumerate(valid_envs):
                env = self.envs[env_idx]
                seat = acting_seats[k]
                action_idx = actions_np[k]
                global_action = cand_indices[k][action_idx]

                step_data = {
                    "context": contexts[k],
                    "candidate_features": feats_list[k],
                    "action_idx": action_idx,
                    "log_prob": log_probs_np[k],
                    "value": values_np[k],
                    "reward": 0.0
                }
                self.trajectories[env_idx][seat].append(step_data)

                rewards = env.step(global_action)
                steps += 1

                for s, r in rewards.items():
                    if len(self.trajectories[env_idx][s]) > 0:
                        self.trajectories[env_idx][s][-1]["reward"] = r
                        self.completed.append(self.trajectories[env_idx][s])
                    self.trajectories[env_idx][s] = []

                if env.done():
                    _ = env.reset(self.rng)
                    self.trajectories[env_idx] = {s: [] for s in range(env.seat_count)}
        
        res = self.completed
        self.completed = []
        return res

class DiscreteRunner:
    def __init__(self, envs, device, rng):
        self.envs = envs
        self.device = device
        self.rng = rng
        self.completed = []
        self.trajectories = [{} for _ in envs]
        for i, env in enumerate(self.envs):
            env.reset(self.rng)
            self.trajectories[i] = {s: [] for s in range(env.seat_count)}

    def collect(self, net, n_steps):
        steps = 0
        while steps < n_steps:
            obs_list, mask_list = [], []
            valid_envs, acting_seats = [], []

            for i, env in enumerate(self.envs):
                seat = env.acting_seat()
                if seat is None:
                    continue
                obs_list.append(env.observe(seat)["features"])
                mask_list.append(env.legal_action_mask())
                valid_envs.append(i)
                acting_seats.append(seat)

            if not valid_envs:
                break

            net.eval()
            with torch.no_grad():
                o_t = torch.tensor(np.array(obs_list), dtype=torch.float32, device=self.device)
                m_t = torch.tensor(np.array(mask_list), dtype=torch.bool, device=self.device)
                logits, values = net(o_t, m_t)
                dist = torch.distributions.Categorical(logits=logits)
                actions = dist.sample()
                log_probs = dist.log_prob(actions)

            actions_np = actions.cpu().numpy()
            log_probs_np = log_probs.cpu().numpy()
            values_np = values.cpu().numpy()

            for k, env_idx in enumerate(valid_envs):
                env = self.envs[env_idx]
                seat = acting_seats[k]
                action = actions_np[k]

                step_data = {
                    "features": obs_list[k],
                    "mask": mask_list[k],
                    "action": action,
                    "log_prob": log_probs_np[k],
                    "value": values_np[k],
                    "reward": 0.0
                }
                self.trajectories[env_idx][seat].append(step_data)

                rewards = env.step(action)
                steps += 1

                for s, r in rewards.items():
                    if len(self.trajectories[env_idx][s]) > 0:
                        self.trajectories[env_idx][s][-1]["reward"] = r
                        self.completed.append(self.trajectories[env_idx][s])
                    self.trajectories[env_idx][s] = []

                if env.done():
                    _ = env.reset(self.rng)
                    self.trajectories[env_idx] = {s: [] for s in range(env.seat_count)}

        res = self.completed
        self.completed = []
        return res

class AuctionRunner:
    def __init__(self, envs, device, rng):
        self.envs = envs
        self.device = device
        self.rng = rng
        self.completed_bid = []
        self.completed_swap = []
        self.trajectories_bid = [{} for _ in envs]
        self.trajectories_swap = [{} for _ in envs]
        for i, env in enumerate(self.envs):
            env.reset(self.rng)
            self.trajectories_bid[i] = {s: [] for s in range(env.seat_count)}
            self.trajectories_swap[i] = {s: [] for s in range(env.seat_count)}

    def collect(self, net_bid, net_swap, n_steps):
        steps = 0
        while steps < n_steps:
            # Gather by action kind
            bid_idx = []
            swap_idx = []
            for i, env in enumerate(self.envs):
                seat = env.acting_seat()
                if seat is None:
                    continue
                if env.action_kind() == "bidding":
                    bid_idx.append(i)
                else:
                    swap_idx.append(i)

            # Process bidding
            if bid_idx:
                obs_list, mask_list, seats = [], [], []
                for i in bid_idx:
                    env = self.envs[i]
                    seat = env.acting_seat()
                    obs_list.append(env.observe(seat)["features"])
                    mask_list.append(env.legal_action_mask())
                    seats.append(seat)
                
                net_bid.eval()
                with torch.no_grad():
                    o_t = torch.tensor(np.array(obs_list), dtype=torch.float32, device=self.device)
                    m_t = torch.tensor(np.array(mask_list), dtype=torch.bool, device=self.device)
                    logits, values = net_bid(o_t, m_t)
                    dist = torch.distributions.Categorical(logits=logits)
                    actions = dist.sample()
                    log_probs = dist.log_prob(actions)

                actions_np = actions.cpu().numpy()
                log_probs_np = log_probs.cpu().numpy()
                values_np = values.cpu().numpy()

                for k, env_idx in enumerate(bid_idx):
                    env = self.envs[env_idx]
                    seat = seats[k]
                    action = actions_np[k]
                    step_data = {
                        "features": obs_list[k],
                        "mask": mask_list[k],
                        "action": action,
                        "log_prob": log_probs_np[k],
                        "value": values_np[k],
                        "reward": 0.0
                    }
                    self.trajectories_bid[env_idx][seat].append(step_data)
                    rewards = env.step(action)
                    steps += 1
                    self._handle_rewards(env_idx, rewards)

            # Process swaps
            if swap_idx:
                contexts, feats_list, cand_indices, seats = [], [], [], []
                for i in swap_idx:
                    env = self.envs[i]
                    seat = env.acting_seat()
                    obs = env.observe(seat)
                    contexts.append(obs["context"])
                    feats_list.append(obs["candidate_features"])
                    cand_indices.append(obs["candidate_indices"])
                    seats.append(seat)

                net_swap.eval()
                with torch.no_grad():
                    ctx_t = torch.tensor(np.array(contexts), dtype=torch.float32, device=self.device)
                    f_t, m_t = pad_candidates(feats_list, feature_len=feats_list[0].shape[1] if len(feats_list[0]) > 0 else 1, device=self.device)
                    logits, values = net_swap(ctx_t, f_t, m_t)
                    dist = torch.distributions.Categorical(logits=logits)
                    actions = dist.sample()
                    log_probs = dist.log_prob(actions)

                actions_np = actions.cpu().numpy()
                log_probs_np = log_probs.cpu().numpy()
                values_np = values.cpu().numpy()

                for k, env_idx in enumerate(swap_idx):
                    env = self.envs[env_idx]
                    seat = seats[k]
                    action_idx = actions_np[k]
                    global_action = cand_indices[k][action_idx]
                    step_data = {
                        "context": contexts[k],
                        "candidate_features": feats_list[k],
                        "action_idx": action_idx,
                        "log_prob": log_probs_np[k],
                        "value": values_np[k],
                        "reward": 0.0
                    }
                    self.trajectories_swap[env_idx][seat].append(step_data)
                    rewards = env.step(global_action)
                    steps += 1
                    self._handle_rewards(env_idx, rewards)

            for i, env in enumerate(self.envs):
                if env.done():
                    _ = env.reset(self.rng)
                    self.trajectories_bid[i] = {s: [] for s in range(env.seat_count)}
                    self.trajectories_swap[i] = {s: [] for s in range(env.seat_count)}

        res_bid = self.completed_bid
        res_swap = self.completed_swap
        self.completed_bid = []
        self.completed_swap = []
        return res_bid, res_swap

    def _handle_rewards(self, env_idx, rewards):
        for s, r in rewards.items():
            if len(self.trajectories_bid[env_idx][s]) > 0:
                self.trajectories_bid[env_idx][s][-1]["reward"] = r
                self.completed_bid.append(self.trajectories_bid[env_idx][s])
            self.trajectories_bid[env_idx][s] = []
            
            if len(self.trajectories_swap[env_idx][s]) > 0:
                self.trajectories_swap[env_idx][s][-1]["reward"] = r
                self.completed_swap.append(self.trajectories_swap[env_idx][s])
            self.trajectories_swap[env_idx][s] = []
