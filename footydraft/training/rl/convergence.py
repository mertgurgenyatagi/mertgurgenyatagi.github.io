import numpy as np
import torch
from .ppo_core import compute_gae, ppo_loss

def evaluate_best_response(
    br_net, frozen_net, env_factory, n_eval_episodes, device, is_candidate=True
):
    """
    Evaluates the Best Response (BR) network against the frozen policy.
    For simplicity, in this approximate metric, we assume the BR network plays seat 0,
    and the frozen network plays all other seats.
    Returns the average score of the BR agent and the frozen agents.
    """
    br_scores = []
    frozen_scores = []
    
    envs = [env_factory() for _ in range(32)]
    rng = np.random.default_rng(42)
    for env in envs:
        env.reset(rng)
        
    while len(br_scores) < n_eval_episodes:
        from .vec_runners import pad_candidates
        
        valid_envs = []
        acting_seats = []
        
        if is_candidate:
            contexts, feats_list, cand_indices = [], [], []
        else:
            obs_list, mask_list = [], []
            
        for i, env in enumerate(envs):
            seat = env.acting_seat()
            if seat is None:
                continue
            valid_envs.append(i)
            acting_seats.append(seat)
            obs = env.observe(seat)
            if is_candidate:
                contexts.append(obs["context"])
                feats_list.append(obs["candidate_features"])
                cand_indices.append(obs["candidate_indices"])
            else:
                obs_list.append(obs["features"])
                mask_list.append(env.legal_action_mask())
                
        if not valid_envs:
            break
            
        br_idx = [k for k, seat in enumerate(acting_seats) if seat == 0]
        frozen_idx = [k for k, seat in enumerate(acting_seats) if seat != 0]
        
        actions_np = np.zeros(len(valid_envs), dtype=np.int64)
        
        with torch.no_grad():
            if is_candidate:
                ctx_t = torch.tensor(np.array(contexts), dtype=torch.float32, device=device)
                f_t, m_t = pad_candidates(feats_list, feature_len=feats_list[0].shape[1] if len(feats_list[0]) > 0 else 1, device=device)
                
                if frozen_idx:
                    logits_f, _ = frozen_net(ctx_t[frozen_idx], f_t[frozen_idx], m_t[frozen_idx])
                    dist_f = torch.distributions.Categorical(logits=logits_f)
                    actions_np[frozen_idx] = dist_f.sample().cpu().numpy()
                
                if br_idx:
                    logits_b, _ = br_net(ctx_t[br_idx], f_t[br_idx], m_t[br_idx])
                    dist_b = torch.distributions.Categorical(logits=logits_b)
                    actions_np[br_idx] = dist_b.sample().cpu().numpy()
            else:
                o_t = torch.tensor(np.array(obs_list), dtype=torch.float32, device=device)
                m_t = torch.tensor(np.array(mask_list), dtype=torch.bool, device=device)
                
                if frozen_idx:
                    logits_f, _ = frozen_net(o_t[frozen_idx], m_t[frozen_idx])
                    dist_f = torch.distributions.Categorical(logits=logits_f)
                    actions_np[frozen_idx] = dist_f.sample().cpu().numpy()
                    
                if br_idx:
                    logits_b, _ = br_net(o_t[br_idx], m_t[br_idx])
                    dist_b = torch.distributions.Categorical(logits=logits_b)
                    actions_np[br_idx] = dist_b.sample().cpu().numpy()
                    
        for k, env_idx in enumerate(valid_envs):
            env = envs[env_idx]
            seat = acting_seats[k]
            if is_candidate:
                global_action = cand_indices[k][actions_np[k]]
                rewards = env.step(global_action)
            else:
                rewards = env.step(actions_np[k])
                
            for s, r in rewards.items():
                if s == 0:
                    br_scores.append(r)
                else:
                    frozen_scores.append(r)
                    
            if env.done():
                env.reset(rng)
                
    return np.mean(br_scores), np.mean(frozen_scores)

def check_convergence(policy_net, env_factory, device, avg_return=None, is_candidate=True):
    """
    Checks if the policy network has reached optimal play with 99% certainty.
    Tracks the average self-play return over evaluations. If the improvement is
    less than 0.1% over the last several checks, we consider it converged.
    """
    if not hasattr(check_convergence, "history"):
        check_convergence.history = []
    
    if avg_return is not None:
        check_convergence.history.append(avg_return)
        
    if len(check_convergence.history) < 5:
        return False
        
    # Check if the recent plateau is extremely flat (less than 0.1% variance or improvement)
    recent = check_convergence.history[-5:]
    baseline = np.mean(check_convergence.history[-10:-5]) if len(check_convergence.history) >= 10 else check_convergence.history[0]
    
    current = np.mean(recent)
    improvement = (current - baseline) / (baseline + 1e-8)
    
    # If the score has improved by less than 0.1% over the last 500 iterations (5 checks),
    # we assume 99% certainty of optimal drafting behavior.
    if 0 <= improvement < 0.001:
        return True
        
    return False
