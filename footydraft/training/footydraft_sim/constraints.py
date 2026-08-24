"""Table-wide constraint system (draftEngine.ts:57-171, GAME-RULES.md §5).
Free Pick only — the other three formats always pass 'none' (no cap).

The most counter-intuitive rule in the game: caps tally across the WHOLE TABLE, not
per squad. The instant any seat takes a Real Madrid player under club-1, Real Madrid
is gone for every seat, not just the one who took it.
"""

import numpy as np

from .formation import POSITION_CODES, slot_for

CAP_FOR = {
    "club-1": ("club", 1),
    "club-3": ("club", 3),
    "nation-1": ("nation", 1),
    "nation-3": ("nation", 3),
}


def cap_for(constraint: str):
    """None for 'none'/unrecognized -> no cap ever applies."""
    return CAP_FOR.get(constraint)


class TableSpend:
    """Table-wide club/nation pick tallies, shared by every seat in a Free Pick draft."""

    def __init__(self, pool):
        self.club_count = np.zeros(pool.n_clubs, dtype=np.int32)
        self.nation_count = np.zeros(pool.n_nations, dtype=np.int32)

    def record(self, pool, player_idx: int) -> None:
        self.club_count[pool.club_idx[player_idx]] += 1
        self.nation_count[pool.nation_idx[player_idx]] += 1


def open_slots_by_position(filled_slot_ids) -> np.ndarray:
    """bool[10], index-aligned with formation.POSITION_CODES: does a seat holding
    `filled_slot_ids` have at least one open slot left for that position code?"""
    filled = set(filled_slot_ids)
    return np.asarray([slot_for(pos, filled) is not None for pos in POSITION_CODES], dtype=bool)


def eligibility_mask(
    pool,
    candidate_indices: np.ndarray,
    taken: np.ndarray,
    filled_slot_ids,
    constraint: str,
    spend: TableSpend,
) -> np.ndarray:
    """bool mask aligned with candidate_indices — True where blockedReason() would be
    None. The three checks are ANDed rather than short-circuited in blockedReason's
    exact order, since only the boolean eligibility matters here, never the message."""
    idx = candidate_indices
    mask = ~taken[idx]
    mask &= open_slots_by_position(filled_slot_ids)[pool.position_idx[idx]]

    cap = cap_for(constraint)
    if cap is not None:
        key, limit = cap
        counts = spend.club_count[pool.club_idx[idx]] if key == "club" else spend.nation_count[pool.nation_idx[idx]]
        mask &= counts < limit

    return mask
