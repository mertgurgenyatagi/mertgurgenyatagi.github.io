"""PPO math shared by every mode's training loop: generalized advantage estimation
over one finished agent-trajectory, and the clipped surrogate loss. Neither function
cares whether the logits came from CandidateScorer or DiscreteHead -- both already
carry -inf at illegal/padding positions, so log_softmax handles masking correctly
either way.
"""

import numpy as np
import torch
import torch.nn.functional as F


def compute_gae(rewards: np.ndarray, values: np.ndarray, gamma: float = 1.0, lam: float = 0.95):
    """rewards, values: 1D arrays of length T for one COMPLETE, terminal trajectory
    (no bootstrap past the end -- every episode here truly ends, there is no
    continuation to estimate). gamma defaults to 1.0: these are finite episodes paid
    a single un-discounted terminal score, and there's no principled reason an early
    pick should count for less than a late one.
    """
    t = len(rewards)
    advantages = np.zeros(t, dtype=np.float32)
    last_gae = 0.0
    for i in reversed(range(t)):
        next_value = values[i + 1] if i + 1 < t else 0.0
        delta = rewards[i] + gamma * next_value - values[i]
        last_gae = delta + gamma * lam * last_gae
        advantages[i] = last_gae
    returns = advantages + values.astype(np.float32)
    return advantages, returns


def ppo_loss(
    logits: torch.Tensor,
    values: torch.Tensor,
    actions: torch.Tensor,
    old_logprobs: torch.Tensor,
    advantages: torch.Tensor,
    returns: torch.Tensor,
    clip_eps: float = 0.2,
    value_coef: float = 0.5,
    entropy_coef: float = 0.01,
):
    """logits: (B, A) with -inf at illegal/padding entries. values, actions,
    old_logprobs, advantages, returns: (B,). actions index into logits' last dim."""
    log_probs_all = F.log_softmax(logits, dim=-1)
    log_probs = log_probs_all.gather(1, actions.unsqueeze(1)).squeeze(1)

    ratio = torch.exp(log_probs - old_logprobs)
    surr1 = ratio * advantages
    surr2 = torch.clamp(ratio, 1.0 - clip_eps, 1.0 + clip_eps) * advantages
    policy_loss = -torch.min(surr1, surr2).mean()

    value_loss = F.mse_loss(values, returns)

    finite = torch.isfinite(logits)
    zero = torch.zeros_like(log_probs_all)
    safe_log_probs = torch.where(finite, log_probs_all, zero)
    safe_probs = torch.where(finite, log_probs_all.exp(), zero)
    entropy = -(safe_probs * safe_log_probs).sum(-1).mean()

    loss = policy_loss + value_coef * value_loss - entropy_coef * entropy
    stats = {
        "policy_loss": policy_loss.item(),
        "value_loss": value_loss.item(),
        "entropy": entropy.item(),
        "approx_kl": (old_logprobs - log_probs).mean().item(),
        "clip_frac": (torch.abs(ratio - 1.0) > clip_eps).float().mean().item(),
    }
    return loss, stats
