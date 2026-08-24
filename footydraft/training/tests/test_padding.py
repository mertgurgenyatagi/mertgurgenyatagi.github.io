import numpy as np
import torch

from rl.padding import pad_candidates


def test_pads_to_max_k_and_masks_correctly():
    feats = [np.ones((3, 2), dtype=np.float32), np.ones((1, 2), dtype=np.float32) * 5, np.zeros((0, 2), dtype=np.float32)]
    padded, mask = pad_candidates(feats, feature_len=2, device="cpu")
    assert padded.shape == (3, 3, 2)
    assert mask.shape == (3, 3)
    assert mask.tolist() == [[True, True, True], [True, False, False], [False, False, False]]
    assert torch.allclose(padded[1, 0], torch.tensor([5.0, 5.0]))


def test_single_empty_batch_still_has_at_least_one_slot():
    padded, mask = pad_candidates([np.zeros((0, 4), dtype=np.float32)], feature_len=4, device="cpu")
    assert padded.shape == (1, 1, 4)
    assert not mask.any()
