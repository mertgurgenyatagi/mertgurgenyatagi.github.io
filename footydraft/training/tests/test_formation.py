from footydraft_sim.formation import SLOTS, SQUAD_SIZE, slot_for, slots_open


def test_eleven_slots():
    assert SQUAD_SIZE == 11
    assert len(SLOTS) == 11


def test_cb_fills_left_before_right():
    assert slot_for("CB", set()) == "cb-l"
    assert slot_for("CB", {"cb-l"}) == "cb-r"
    assert slot_for("CB", {"cb-l", "cb-r"}) is None


def test_singular_position_slot():
    assert slot_for("GK", set()) == "gk"
    assert slot_for("GK", {"gk"}) is None


def test_slots_open_formation_order():
    assert slots_open(set(), "CB") == ["cb-l", "cb-r"]
    assert slots_open({"cb-l"}, "CB") == ["cb-r"]
    assert slots_open({"cb-l", "cb-r"}, "CB") == []
