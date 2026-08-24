from dataclasses import dataclass

import numpy as np
import pytest

from footydraft_sim.constraints import TableSpend, cap_for, eligibility_mask, open_slots_by_position
from footydraft_sim.formation import POSITION_CODES


@dataclass
class FakePool:
    position_idx: np.ndarray
    club_idx: np.ndarray
    nation_idx: np.ndarray
    n_clubs: int
    n_nations: int


@pytest.fixture
def pool():
    # 4 players: two Real Madrid (club 0) CBs of different nations, one Barca (club 1)
    # CB, one Real Madrid ST.
    pos = {p: i for i, p in enumerate(POSITION_CODES)}
    return FakePool(
        position_idx=np.array([pos["CB"], pos["CB"], pos["CB"], pos["ST"]], dtype=np.int8),
        club_idx=np.array([0, 0, 1, 0], dtype=np.int32),  # real-madrid, real-madrid, barca, real-madrid
        nation_idx=np.array([0, 1, 2, 0], dtype=np.int32),
        n_clubs=2,
        n_nations=3,
    )


def test_cap_for_mapping():
    assert cap_for("club-1") == ("club", 1)
    assert cap_for("club-3") == ("club", 3)
    assert cap_for("nation-1") == ("nation", 1)
    assert cap_for("nation-3") == ("nation", 3)
    assert cap_for("none") is None
    assert cap_for("anything-else") is None


def test_taken_players_blocked(pool):
    taken = np.array([True, False, False, False])
    mask = eligibility_mask(pool, np.array([0, 1]), taken, set(), "none", TableSpend(pool))
    assert mask.tolist() == [False, True]


def test_own_slot_full_blocks_position(pool):
    # Own squad already has both CB slots filled -> no CB is eligible regardless of pool state.
    taken = np.zeros(4, dtype=bool)
    mask = eligibility_mask(pool, np.array([0, 1, 3]), taken, {"cb-l", "cb-r"}, "none", TableSpend(pool))
    assert mask.tolist() == [False, False, True]  # index 3 is the ST, still open


def test_club_cap_is_table_wide(pool):
    taken = np.zeros(4, dtype=bool)
    spend = TableSpend(pool)
    spend.record(pool, 0)  # someone (any seat) takes a Real Madrid player
    mask = eligibility_mask(pool, np.array([0, 1, 2, 3]), taken, set(), "club-1", spend)
    # Every other Real Madrid player (1, 3) is now blocked table-wide; Barca (2) unaffected.
    assert mask.tolist() == [False, False, True, False]


def test_club_cap_of_three_allows_up_to_three(pool):
    taken = np.zeros(4, dtype=bool)
    spend = TableSpend(pool)
    spend.record(pool, 0)
    spend.record(pool, 1)
    mask = eligibility_mask(pool, np.array([3]), taken, set(), "club-3", spend)
    assert mask.tolist() == [True]  # 2 taken so far, cap is 3
    spend.record(pool, 3)
    mask = eligibility_mask(pool, np.array([3]), taken, set(), "club-3", spend)
    # index 3 itself hasn't been marked taken, but recording 3 already pushed the
    # club count to 3 -> a further real-madrid pick would be blocked
    assert mask.tolist() == [False]


def test_nation_cap(pool):
    taken = np.zeros(4, dtype=bool)
    spend = TableSpend(pool)
    spend.record(pool, 0)  # nation 0
    mask = eligibility_mask(pool, np.array([0, 1, 2, 3]), taken, set(), "nation-1", spend)
    # index 0 and 3 share nation 0 -> both blocked; 1 (nation 1) and 2 (nation 2) fine
    assert mask.tolist() == [False, True, True, False]


def test_open_slots_by_position_shape():
    mask = open_slots_by_position(set())
    assert mask.shape == (10,)
    assert mask.all()
    mask = open_slots_by_position({"gk"})
    assert not mask[POSITION_CODES.index("GK")]
