from dataclasses import dataclass

import numpy as np

from footydraft_sim.scoring import POSITION_COEFFICIENTS
from footydraft_sim.squad import Squad


@dataclass
class FakePool:
    ability: np.ndarray


def test_assign_fills_first_open_cb_slot_then_second():
    squad = Squad()
    assert squad.assign("CB", player_idx=10) == "cb-l"
    assert squad.assign("CB", player_idx=20) == "cb-r"
    assert squad.assign("CB", player_idx=30) is None  # both CB slots full
    assert squad.filled_slots() == {"cb-l", "cb-r"}


def test_score_sums_weighted_ability():
    squad = Squad()
    squad.assign("GK", player_idx=0)
    squad.assign("ST", player_idx=1)
    pool = FakePool(ability=np.array([100.0, 200.0], dtype=np.float32))
    expected = 100.0 * POSITION_COEFFICIENTS["GK"] + 200.0 * POSITION_COEFFICIENTS["ST"]
    assert abs(squad.score(pool) - expected) < 1e-6


def test_empty_squad_scores_zero():
    pool = FakePool(ability=np.array([], dtype=np.float32))
    assert Squad().score(pool) == 0.0


def test_is_full():
    squad = Squad()
    assert not squad.is_full()
    positions = ["GK", "LB", "CB", "CB", "RB", "CDM", "CM", "LW", "AMF", "RW", "ST"]
    for i, pos in enumerate(positions):
        squad.assign(pos, i)
    assert squad.is_full()
