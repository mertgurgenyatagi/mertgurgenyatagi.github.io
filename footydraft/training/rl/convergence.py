import copy
import numpy as np
import torch
from .ppo_core import compute_gae, ppo_loss
from .padding import pad_candidates


def collect_asymmetric_candidate(br_net, frozen_net, envs, n_steps, device, rng):
    """
    Collects rollouts where seat 0 uses br_net (learning) and all other seats
    use frozen_net (fixed opponent).
    Returns completed trajectories for seat 0.
    """
    trajectories = {i: [] for i in range(len(envs))}
    completed = []
    steps = 0

    while steps < n_steps:
        contexts, feats_list, cand_indices = [], [], []
        valid_envs, acting_seats = [], []

        for i, env in enumerate(envs):
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

        br_idx = [k for k, s in enumerate(acting_seats) if s == 0]
        frozen_idx = [k for k, s in enumerate(acting_seats) if s != 0]

        actions_np = np.zeros(len(valid_envs), dtype=np.int64)
        log_probs_np = np.zeros(len(valid_envs), dtype=np.float32)
        values_np = np.zeros(len(valid_envs), dtype=np.float32)

        ctx_t = torch.tensor(np.array(contexts), dtype=torch.float32, device=device)
        f_t, m_t = pad_candidates(feats_list, feature_len=feats_list[0].shape[1] if len(feats_list[0]) > 0 else 1, device=device)

        with torch.no_grad():
            if frozen_idx:
                frozen_net.eval()
                logits_f, _ = frozen_net(ctx_t[frozen_idx], f_t[frozen_idx], m_t[frozen_idx])
                dist_f = torch.distributions.Categorical(logits=logits_f)
                actions_np[frozen_idx] = dist_f.sample().cpu().numpy()

            if br_idx:
                br_net.eval()
                logits_b, vals_b = br_net(ctx_t[br_idx], f_t[br_idx], m_t[br_idx])
                dist_b = torch.distributions.Categorical(logits=logits_b)
                acts_b = dist_b.sample()
                actions_np[br_idx] = acts_b.cpu().numpy()
                log_probs_np[br_idx] = dist_b.log_prob(acts_b).cpu().numpy()
                values_np[br_idx] = vals_b.cpu().numpy()

        for k, env_idx in enumerate(valid_envs):
            env = envs[env_idx]
            seat = acting_seats[k]
            action_idx = actions_np[k]
            global_action = cand_indices[k][action_idx]

            if seat == 0:
                step_data = {
                    "context": contexts[k],
                    "candidate_features": feats_list[k],
                    "action_idx": action_idx,
                    "log_prob": log_probs_np[k],
                    "value": values_np[k],
                    "reward": 0.0,
                }
                trajectories[env_idx].append(step_data)

            rewards = env.step(global_action)
            steps += 1

            for s, r in rewards.items():
                if s == 0 and len(trajectories[env_idx]) > 0:
                    trajectories[env_idx][-1]["reward"] = r
                    completed.append(trajectories[env_idx])
                    trajectories[env_idx] = []

            if env.done():
                env.reset(rng)
                trajectories[env_idx] = []

    return completed


def collect_asymmetric_discrete(br_net, frozen_net, envs, n_steps, device, rng):
    """
    Collects rollouts where seat 0 uses br_net (discrete) and all other seats
    use frozen_net (discrete).
    Returns completed trajectories for seat 0.
    """
    trajectories = {i: [] for i in range(len(envs))}
    completed = []
    steps = 0

    while steps < n_steps:
        obs_list, mask_list = [], []
        valid_envs, acting_seats = [], []

        for i, env in enumerate(envs):
            seat = env.acting_seat()
            if seat is None:
                continue
            obs_list.append(env.observe(seat)["features"])
            mask_list.append(env.legal_action_mask())
            valid_envs.append(i)
            acting_seats.append(seat)

        if not valid_envs:
            break

        br_idx = [k for k, s in enumerate(acting_seats) if s == 0]
        frozen_idx = [k for k, s in enumerate(acting_seats) if s != 0]

        actions_np = np.zeros(len(valid_envs), dtype=np.int64)
        log_probs_np = np.zeros(len(valid_envs), dtype=np.float32)
        values_np = np.zeros(len(valid_envs), dtype=np.float32)

        o_t = torch.tensor(np.array(obs_list), dtype=torch.float32, device=device)
        m_t = torch.tensor(np.array(mask_list), dtype=torch.bool, device=device)

        with torch.no_grad():
            if frozen_idx:
                frozen_net.eval()
                logits_f, _ = frozen_net(o_t[frozen_idx], m_t[frozen_idx])
                dist_f = torch.distributions.Categorical(logits=logits_f)
                actions_np[frozen_idx] = dist_f.sample().cpu().numpy()

            if br_idx:
                br_net.eval()
                logits_b, vals_b = br_net(o_t[br_idx], m_t[br_idx])
                dist_b = torch.distributions.Categorical(logits=logits_b)
                acts_b = dist_b.sample()
                actions_np[br_idx] = acts_b.cpu().numpy()
                log_probs_np[br_idx] = dist_b.log_prob(acts_b).cpu().numpy()
                values_np[br_idx] = vals_b.cpu().numpy()

        for k, env_idx in enumerate(valid_envs):
            env = envs[env_idx]
            seat = acting_seats[k]
            action = actions_np[k]

            if seat == 0:
                step_data = {
                    "features": obs_list[k],
                    "mask": mask_list[k],
                    "action": action,
                    "log_prob": log_probs_np[k],
                    "value": values_np[k],
                    "reward": 0.0,
                }
                trajectories[env_idx].append(step_data)

            rewards = env.step(action)
            steps += 1

            for s, r in rewards.items():
                if s == 0 and len(trajectories[env_idx]) > 0:
                    trajectories[env_idx][-1]["reward"] = r
                    completed.append(trajectories[env_idx])
                    trajectories[env_idx] = []

            if env.done():
                env.reset(rng)
                trajectories[env_idx] = []

    return completed


def evaluate_policy_vs_policy(p0_net, p_other_net, env_factory, n_episodes, device, is_candidate=True):
    """
    Evaluates policy p0_net at seat 0 against p_other_net at all other seats over n_episodes.
    Returns array of seat 0 rewards and array of opponent rewards.
    """
    seat0_scores = []
    other_scores = []

    envs = [env_factory() for _ in range(32)]
    rng = np.random.default_rng(1337)
    for env in envs:
        env.reset(rng)

    while len(seat0_scores) < n_episodes:
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

        p0_idx = [k for k, s in enumerate(acting_seats) if s == 0]
        other_idx = [k for k, s in enumerate(acting_seats) if s != 0]
        actions_np = np.zeros(len(valid_envs), dtype=np.int64)

        with torch.no_grad():
            if is_candidate:
                ctx_t = torch.tensor(np.array(contexts), dtype=torch.float32, device=device)
                f_t, m_t = pad_candidates(feats_list, feature_len=feats_list[0].shape[1] if len(feats_list[0]) > 0 else 1, device=device)

                if other_idx:
                    p_other_net.eval()
                    logits_o, _ = p_other_net(ctx_t[other_idx], f_t[other_idx], m_t[other_idx])
                    actions_np[other_idx] = torch.argmax(logits_o, dim=-1).cpu().numpy()

                if p0_idx:
                    p0_net.eval()
                    logits_0, _ = p0_net(ctx_t[p0_idx], f_t[p0_idx], m_t[p0_idx])
                    actions_np[p0_idx] = torch.argmax(logits_0, dim=-1).cpu().numpy()
            else:
                o_t = torch.tensor(np.array(obs_list), dtype=torch.float32, device=device)
                m_t = torch.tensor(np.array(mask_list), dtype=torch.bool, device=device)

                if other_idx:
                    p_other_net.eval()
                    logits_o, _ = p_other_net(o_t[other_idx], m_t[other_idx])
                    actions_np[other_idx] = torch.argmax(logits_o, dim=-1).cpu().numpy()

                if p0_idx:
                    p0_net.eval()
                    logits_0, _ = p0_net(o_t[p0_idx], m_t[p0_idx])
                    actions_np[p0_idx] = torch.argmax(logits_0, dim=-1).cpu().numpy()

        for k, env_idx in enumerate(valid_envs):
            env = envs[env_idx]
            if is_candidate:
                global_action = cand_indices[k][actions_np[k]]
                rewards = env.step(global_action)
            else:
                rewards = env.step(actions_np[k])

            for s, r in rewards.items():
                if s == 0:
                    seat0_scores.append(r)
                else:
                    other_scores.append(r)

            if env.done():
                env.reset(rng)

    return np.array(seat0_scores[:n_episodes]), np.array(other_scores[:n_episodes])


def check_convergence(
    policy_net,
    env_factory,
    device,
    is_candidate=True,
    n_br_train_iters=15,
    n_eval_episodes=150,
    threshold_pct=0.5,
    lr=3e-4,
    avg_return=None,
):
    """
    Checks if policy_net has converged to an unexploitable strategy (99% confidence).
    1. Clones policy_net into a Best-Response (BR) network.
    2. Trains BR against the frozen policy_net for n_br_train_iters.
    3. Evaluates BR vs Frozen, and Frozen vs Frozen baseline.
    4. Calculates exploitation margin and 99% confidence upper bound.
    """
    print("\n" + "=" * 80)
    print("[Convergence Check] Training Best-Response Challenger against Frozen Policy...")

    br_net = copy.deepcopy(policy_net).to(device)
    br_opt = torch.optim.Adam(br_net.parameters(), lr=lr)

    train_envs = [env_factory() for _ in range(16)]
    rng = np.random.default_rng(999)
    for env in train_envs:
        env.reset(rng)

    # Train BR challenger
    for _ in range(n_br_train_iters):
        if is_candidate:
            trajs = collect_asymmetric_candidate(br_net, policy_net, train_envs, 1024, device, rng)
            if not trajs:
                continue
            all_contexts, all_feats = [], []
            all_actions, all_log_probs, all_returns, all_advantages = [], [], [], []
            for t in trajs:
                rewards = np.array([s["reward"] for s in t], dtype=np.float32)
                values = np.array([s["value"] for s in t], dtype=np.float32)
                adv, ret = compute_gae(rewards, values)
                for i, s in enumerate(t):
                    all_contexts.append(s["context"])
                    all_feats.append(s["candidate_features"])
                    all_actions.append(s["action_idx"])
                    all_log_probs.append(s["log_prob"])
                    all_returns.append(ret[i])
                    all_advantages.append(adv[i])

            if len(all_returns) > 0:
                adv_tensor = torch.tensor(np.array(all_advantages), dtype=torch.float32, device=device)
                adv_tensor = (adv_tensor - adv_tensor.mean()) / (adv_tensor.std() + 1e-8)
                ret_tensor = torch.tensor(np.array(all_returns), dtype=torch.float32, device=device)
                act_tensor = torch.tensor(np.array(all_actions), dtype=torch.int64, device=device)
                logp_tensor = torch.tensor(np.array(all_log_probs), dtype=torch.float32, device=device)
                ctx_tensor = torch.tensor(np.array(all_contexts), dtype=torch.float32, device=device)
                feats_tensor, mask_tensor = pad_candidates(all_feats, feature_len=all_feats[0].shape[1] if len(all_feats[0]) > 0 else 1, device=device)

                br_net.train()
                for _ in range(2):
                    logits, values = br_net(ctx_tensor, feats_tensor, mask_tensor)
                    loss, _ = ppo_loss(logits, values, act_tensor, logp_tensor, adv_tensor, ret_tensor)
                    br_opt.zero_grad()
                    loss.backward()
                    torch.nn.utils.clip_grad_norm_(br_net.parameters(), 0.5)
                    br_opt.step()
        else:
            trajs = collect_asymmetric_discrete(br_net, policy_net, train_envs, 1024, device, rng)
            if not trajs:
                continue
            all_obs, all_masks = [], []
            all_actions, all_log_probs, all_returns, all_advantages = [], [], [], []
            for t in trajs:
                rewards = np.array([s["reward"] for s in t], dtype=np.float32)
                values = np.array([s["value"] for s in t], dtype=np.float32)
                adv, ret = compute_gae(rewards, values)
                for i, s in enumerate(t):
                    all_obs.append(s["features"])
                    all_masks.append(s["mask"])
                    all_actions.append(s["action"])
                    all_log_probs.append(s["log_prob"])
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

                br_net.train()
                for _ in range(2):
                    logits, values = br_net(obs_tensor, mask_tensor)
                    loss, _ = ppo_loss(logits, values, act_tensor, logp_tensor, adv_tensor, ret_tensor)
                    br_opt.zero_grad()
                    loss.backward()
                    torch.nn.utils.clip_grad_norm_(br_net.parameters(), 0.5)
                    br_opt.step()

    print("[Convergence Check] Evaluating Matchups...")
    br_scores, _ = evaluate_policy_vs_policy(br_net, policy_net, env_factory, n_eval_episodes, device, is_candidate=is_candidate)
    base_scores, _ = evaluate_policy_vs_policy(policy_net, policy_net, env_factory, n_eval_episodes, device, is_candidate=is_candidate)

    mean_br = float(np.mean(br_scores))
    std_br = float(np.std(br_scores))
    mean_base = float(np.mean(base_scores))
    std_base = float(np.std(base_scores))

    delta = mean_br - mean_base
    se = np.sqrt((std_br ** 2) / len(br_scores) + (std_base ** 2) / len(base_scores))
    ci_99_upper = delta + 2.326 * se  # 99% one-tailed confidence upper bound

    exploit_pct = max(0.0, (delta / mean_base) * 100.0)
    ci_exploit_pct = max(0.0, (ci_99_upper / mean_base) * 100.0)

    print(f"- Best Response Score : {mean_br:.2f} ± {std_br:.2f}")
    print(f"- Frozen Policy Score : {mean_base:.2f} ± {std_base:.2f}")
    print(f"- Exploitation Margin : {delta:+.2f} pts ({exploit_pct:.3f}%)")
    print(f"- 99% Upper Conf Bound: {ci_99_upper:+.2f} pts ({ci_exploit_pct:.3f}%) [Threshold: < {threshold_pct:.2f}%]")

    converged = ci_exploit_pct < threshold_pct
    if converged:
        print("- Status: OPTIMAL PLAY REACHED with 99% CERTAINTY.")
    else:
        print("- Status: NOT YET CONVERGED (Strategy remains exploitable). Continuing training...")
    print("=" * 80 + "\n")

    return converged
