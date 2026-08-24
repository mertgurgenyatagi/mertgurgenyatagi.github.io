"""Two network families, covering all four modes' decision shapes:

  - CandidateScorer: 'pick one legal candidate from a variable-size list' decisions
    (Free Pick, Spin the Wheel, Auction's swap phase). Every env already pre-filters
    candidate_indices to legal-only, so every scored slot is a real choice; the mask
    here exists purely to let variable K be batched together (padding), not to encode
    game-legality.
  - DiscreteHead: small fixed-action-space decisions (Deal or No Deal's 4-way choice,
    Auction's 5-way bidding choice).

Both expose the same (logits, value) contract so rl/ppo_core.py's loss function is
identical regardless of which family produced them. No feature here is a hint about
what's good -- ability/price/position/etc. are raw facts about the game state, and the
network decides what they mean purely from the score it receives at each episode's end.
"""

import torch
import torch.nn as nn


class CandidateScorer(nn.Module):
    def __init__(self, context_len: int, candidate_feature_len: int, hidden: int = 128):
        super().__init__()
        self.context_net = nn.Sequential(
            nn.Linear(context_len, hidden), nn.ReLU(),
            nn.Linear(hidden, hidden), nn.ReLU(),
        )
        self.candidate_net = nn.Sequential(
            nn.Linear(candidate_feature_len, hidden), nn.ReLU(),
            nn.Linear(hidden, hidden), nn.ReLU(),
        )
        self.score_head = nn.Sequential(
            nn.Linear(hidden * 2, hidden), nn.ReLU(),
            nn.Linear(hidden, 1),
        )
        self.value_head = nn.Sequential(
            nn.Linear(hidden * 2, hidden), nn.ReLU(),
            nn.Linear(hidden, 1),
        )

    def forward(self, context: torch.Tensor, candidate_features: torch.Tensor, candidate_mask: torch.Tensor):
        """context: (B, context_len). candidate_features: (B, K, feat_len).
        candidate_mask: (B, K) bool, True at real (non-padding) candidate slots.
        Returns logits (B, K) [-inf at padding] and value (B,)."""
        ctx_embed = self.context_net(context)
        b, k, _ = candidate_features.shape
        cand_embed = self.candidate_net(candidate_features)
        ctx_broadcast = ctx_embed.unsqueeze(1).expand(-1, k, -1)
        combined = torch.cat([cand_embed, ctx_broadcast], dim=-1)
        logits = self.score_head(combined).squeeze(-1)
        logits = logits.masked_fill(~candidate_mask, float("-inf"))

        denom = candidate_mask.sum(1, keepdim=True).clamp(min=1)
        pooled = (cand_embed * candidate_mask.unsqueeze(-1)).sum(1) / denom
        value = self.value_head(torch.cat([pooled, ctx_embed], dim=-1)).squeeze(-1)
        return logits, value


class DiscreteHead(nn.Module):
    def __init__(self, obs_len: int, n_actions: int, hidden: int = 128):
        super().__init__()
        self.trunk = nn.Sequential(
            nn.Linear(obs_len, hidden), nn.ReLU(),
            nn.Linear(hidden, hidden), nn.ReLU(),
        )
        self.policy_head = nn.Linear(hidden, n_actions)
        self.value_head = nn.Linear(hidden, 1)

    def forward(self, features: torch.Tensor, action_mask: torch.Tensor):
        """features: (B, obs_len). action_mask: (B, n_actions) bool.
        Returns logits (B, n_actions) [-inf where illegal] and value (B,)."""
        h = self.trunk(features)
        logits = self.policy_head(h)
        logits = logits.masked_fill(~action_mask, float("-inf"))
        value = self.value_head(h).squeeze(-1)
        return logits, value
