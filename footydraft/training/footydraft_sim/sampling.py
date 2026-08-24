"""Ability-skewed sampling. auctionEngine.ts's drawSkewed() and dondEngine.ts's
skewedSample() are independently-coded but identical in formula (GAME-RULES.md §3.2);
one implementation here serves both engines.

weight(p) = exp((ability[p] - max(ability in candidate set)) / SKEW_TEMPERATURE)
Draw = roulette-wheel without replacement: cumulative-weight roll, remove, repeat.
Softmax against the *local* best of whatever candidate set it's handed, not a global
max — so the shape is scale-invariant to which slice (position-filtered pool, or
whole-pool remainder) it's drawing from.
"""

import numpy as np

SKEW_TEMPERATURE = 10.0


def draw_skewed(
    rng: np.random.Generator,
    candidate_indices: np.ndarray,
    ability: np.ndarray,
    count: int,
) -> np.ndarray:
    """Draw up to `count` distinct indices from candidate_indices, ability-skewed,
    without replacement. Returns fewer than `count` only if the candidate set is
    smaller than count (matches the source: no error, just draws what's there)."""
    remaining = list(candidate_indices)
    chosen = []
    n = min(count, len(remaining))
    for _ in range(n):
        local_ability = ability[remaining]
        best = local_ability.max()
        weights = np.exp((local_ability - best) / SKEW_TEMPERATURE)
        total = weights.sum()
        roll = rng.random() * total
        cum = np.cumsum(weights)
        pick_pos = int(np.searchsorted(cum, roll, side="left"))
        pick_pos = min(pick_pos, len(remaining) - 1)
        chosen.append(remaining[pick_pos])
        del remaining[pick_pos]
    return np.asarray(chosen, dtype=np.int64)
