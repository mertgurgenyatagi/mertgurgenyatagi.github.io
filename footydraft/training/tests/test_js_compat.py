from footydraft_sim.js_compat import js_round


def test_half_ties_round_up_like_js_not_banker_rounding():
    # Python's builtin round(0.5) == 0 (banker's rounding); JS's Math.round(0.5) == 1.
    assert js_round(0.5) == 1
    assert js_round(1.5) == 2
    assert js_round(2.5) == 3  # builtin round(2.5) == 2 -- this is the case that differs
    assert js_round(21.5) == 22


def test_ordinary_rounding_unaffected():
    assert js_round(21.6776) == 22
    assert js_round(21.3) == 21
    assert js_round(0.0) == 0
