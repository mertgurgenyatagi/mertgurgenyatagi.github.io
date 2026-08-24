import numpy as np
import torch

from rl.ppo_core import compute_gae, ppo_loss


def test_gae_full_monte_carlo_matches_terminal_reward_everywhere():
    # gamma=lam=1 (full Monte Carlo) with a single terminal reward: the return
    # estimate at EVERY timestep must equal the total (only) reward, regardless of
    # what the value function guessed along the way -- this is the key property that
    # makes sparse terminal-only rewards learnable at all.
    rewards = np.array([0.0, 0.0, 10.0], dtype=np.float32)
    values = np.array([1.0, 2.0, 3.0], dtype=np.float32)
    advantages, returns = compute_gae(rewards, values, gamma=1.0, lam=1.0)
    assert returns.shape == (3,)
    np.testing.assert_allclose(returns, [10.0, 10.0, 10.0], atol=1e-5)
    np.testing.assert_allclose(advantages, returns - values, atol=1e-5)


def test_gae_zero_value_baseline_gives_constant_advantage():
    rewards = np.array([0.0, 0.0, 5.0], dtype=np.float32)
    values = np.zeros(3, dtype=np.float32)
    advantages, returns = compute_gae(rewards, values, gamma=1.0, lam=1.0)
    np.testing.assert_allclose(advantages, [5.0, 5.0, 5.0], atol=1e-5)


def test_gae_single_step_trajectory():
    advantages, returns = compute_gae(np.array([7.0], dtype=np.float32), np.array([2.0], dtype=np.float32), gamma=1.0, lam=0.95)
    np.testing.assert_allclose(advantages, [5.0], atol=1e-5)
    np.testing.assert_allclose(returns, [7.0], atol=1e-5)


def test_ppo_loss_policy_term_reduces_to_mean_advantage_when_ratio_is_one():
    logits = torch.tensor([[1.0, 2.0, -1.0], [0.5, 0.5, 0.5]])
    actions = torch.tensor([1, 2])
    old_logprobs = torch.log_softmax(logits, dim=-1).gather(1, actions.unsqueeze(1)).squeeze(1).detach()
    values = torch.tensor([0.0, 0.0])
    returns = torch.tensor([3.0, -1.0])
    advantages = torch.tensor([2.0, -4.0])

    loss, stats = ppo_loss(logits, values, actions, old_logprobs, advantages, returns, value_coef=0.0, entropy_coef=0.0)
    expected_policy_loss = -advantages.mean().item()
    assert abs(stats["policy_loss"] - expected_policy_loss) < 1e-5
    assert abs(stats["approx_kl"]) < 1e-6


def test_ppo_loss_masks_illegal_logits_without_nan():
    logits = torch.tensor([[1.0, float("-inf"), float("-inf")], [0.1, 0.2, float("-inf")]])
    actions = torch.tensor([0, 1])
    old_logprobs = torch.log_softmax(logits, dim=-1).gather(1, actions.unsqueeze(1)).squeeze(1).detach()
    values = torch.tensor([0.5, -0.5])
    returns = torch.tensor([1.0, 0.0])
    advantages = torch.tensor([0.5, -0.5])

    loss, stats = ppo_loss(logits, values, actions, old_logprobs, advantages, returns)
    assert torch.isfinite(loss)
    assert not np.isnan(stats["entropy"])
    assert stats["entropy"] >= 0.0


def test_ppo_loss_value_term_matches_mse():
    logits = torch.zeros(4, 3)
    actions = torch.tensor([0, 1, 2, 0])
    old_logprobs = torch.log_softmax(logits, dim=-1).gather(1, actions.unsqueeze(1)).squeeze(1).detach()
    values = torch.tensor([1.0, 2.0, 3.0, 4.0])
    returns = torch.tensor([1.5, 2.5, 2.0, 4.0])
    advantages = torch.zeros(4)

    loss, stats = ppo_loss(logits, values, actions, old_logprobs, advantages, returns, value_coef=1.0, entropy_coef=0.0)
    expected = ((values - returns) ** 2).mean().item()
    assert abs(stats["value_loss"] - expected) < 1e-5


def test_ppo_loss_gradients_flow_through_a_real_network():
    from rl.networks import CandidateScorer, DiscreteHead

    net = CandidateScorer(context_len=6, candidate_feature_len=4, hidden=16)
    context = torch.randn(5, 6)
    candidate_features = torch.randn(5, 3, 4)
    candidate_mask = torch.tensor([[True, True, False]] * 5)
    logits, values = net(context, candidate_features, candidate_mask)
    actions = torch.tensor([0, 1, 0, 1, 0])
    old_logprobs = torch.log_softmax(logits, dim=-1).gather(1, actions.unsqueeze(1)).squeeze(1).detach()
    advantages = torch.randn(5)
    returns = torch.randn(5)

    loss, _ = ppo_loss(logits, values, actions, old_logprobs, advantages, returns)
    loss.backward()
    assert any(p.grad is not None and torch.any(p.grad != 0) for p in net.parameters())

    disc = DiscreteHead(obs_len=8, n_actions=4, hidden=16)
    features = torch.randn(5, 8)
    action_mask = torch.tensor([[True, True, True, False]] * 5)
    logits2, values2 = disc(features, action_mask)
    actions2 = torch.tensor([0, 1, 2, 0, 1])
    old_logprobs2 = torch.log_softmax(logits2, dim=-1).gather(1, actions2.unsqueeze(1)).squeeze(1).detach()
    loss2, _ = ppo_loss(logits2, values2, actions2, old_logprobs2, torch.randn(5), torch.randn(5))
    loss2.backward()
    assert any(p.grad is not None and torch.any(p.grad != 0) for p in disc.parameters())
