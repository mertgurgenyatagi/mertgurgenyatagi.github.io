import numpy as np

from footydraft_sim.scoring import POSITION_COEFFICIENTS, score_from_arrays, score_squad


def test_coefficients_match_supplied_values():
    assert POSITION_COEFFICIENTS["ST"] == 1.0845606088979698
    assert POSITION_COEFFICIENTS["AMF"] == 1.062368949987575  # CAM in the source table
    assert POSITION_COEFFICIENTS["GK"] == 0.8357558406619451
    assert len(POSITION_COEFFICIENTS) == 10


def test_score_squad_sums_weighted_ability():
    ability_by_slot = {"gk": 100.0, "st": 200.0}
    slot_position = {"gk": "GK", "st": "ST"}
    expected = 100.0 * POSITION_COEFFICIENTS["GK"] + 200.0 * POSITION_COEFFICIENTS["ST"]
    assert score_squad(ability_by_slot, slot_position) == expected


def test_score_from_arrays_matches_reference():
    ability = np.array([100.0, 200.0], dtype=np.float32)
    position_idx = np.array([0, 9], dtype=np.int8)  # GK, ST per formation.POSITION_CODES order
    from footydraft_sim.formation import POSITION_CODES

    assert POSITION_CODES[0] == "GK"
    assert POSITION_CODES[9] == "ST"
    expected = 100.0 * POSITION_COEFFICIENTS["GK"] + 200.0 * POSITION_COEFFICIENTS["ST"]
    assert abs(score_from_arrays(ability, position_idx) - expected) < 1e-3


def test_empty_squad_scores_zero():
    assert score_squad({}, {}) == 0
