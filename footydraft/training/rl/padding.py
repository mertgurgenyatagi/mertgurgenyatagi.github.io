"""Batches a list of variable-length candidate feature arrays into one padded tensor
+ mask, for CandidateScorer's batched forward pass."""

import numpy as np
import torch


def pad_candidates(feature_list: list, feature_len: int, device) -> tuple[torch.Tensor, torch.Tensor]:
    """feature_list: list of (K_i, feature_len) numpy arrays, K_i possibly 0.
    Returns (features (B, max_k, feature_len), mask (B, max_k) bool)."""
    batch = len(feature_list)
    max_k = max((len(f) for f in feature_list), default=1)
    max_k = max(max_k, 1)
    padded = np.zeros((batch, max_k, feature_len), dtype=np.float32)
    mask = np.zeros((batch, max_k), dtype=bool)
    for i, feats in enumerate(feature_list):
        k = len(feats)
        if k > 0:
            padded[i, :k] = feats
            mask[i, :k] = True
    return torch.from_numpy(padded).to(device), torch.from_numpy(mask).to(device)
