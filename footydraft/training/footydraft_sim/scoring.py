"""The training objective. Not part of the shipped app (SquadCompare has no scoring at
all) — this formula was supplied directly by the project owner as what 'optimal play'
means: sum of each final-XI player's hidden ability, weighted by a position coefficient.
Graveyard/spare players never count, in any format."""

import numpy as np

from .formation import POSITION_CODES

# Supplied verbatim. CAM in the source table == AMF in this codebase's PositionCode.
POSITION_COEFFICIENTS = {
    "ST": 1.0845606088979698,
    "AMF": 1.062368949987575,  # CAM
    "CM": 1.0612402700807655,
    "RW": 1.0342148104533873,
    "LW": 1.03217684585867,
    "CDM": 0.9827142030753236,
    "RB": 0.976043335408416,
    "LB": 0.975012260497732,
    "CB": 0.9729875137457032,
    "GK": 0.8357558406619451,
}
assert set(POSITION_COEFFICIENTS) == set(POSITION_CODES)

# Same coefficients, ordered to match formation.POSITION_CODES — for vectorized scoring
# against position_idx arrays.
COEFFICIENT_BY_POSITION_IDX = np.asarray(
    [POSITION_COEFFICIENTS[p] for p in POSITION_CODES], dtype=np.float32
)


def score_squad(ability_by_slot: dict, slot_position: dict) -> float:
    """Reference (non-vectorized) scorer: {slot_id: ability} -> float.

    Only ever called on a *complete* squad in practice (every format guarantees full
    slots by the time a score is asked for), but sums over whatever's given either way.
    """
    return sum(ability * POSITION_COEFFICIENTS[slot_position[slot]] for slot, ability in ability_by_slot.items())


def score_from_arrays(ability: np.ndarray, position_idx: np.ndarray) -> float:
    """Vectorized scorer over parallel (ability, position_idx) arrays for one squad's
    11 occupants (or any subset — used by the env for partial-state bookkeeping too)."""
    return float(np.sum(ability * COEFFICIENT_BY_POSITION_IDX[position_idx]))
