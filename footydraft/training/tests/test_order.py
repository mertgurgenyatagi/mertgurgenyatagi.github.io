from footydraft_sim.order import round_at, seat_at, seat_order


def test_snake_round_zero_ascending():
    assert [seat_at(i, 4) for i in range(4)] == [0, 1, 2, 3]


def test_snake_round_one_reverses():
    assert [seat_at(i, 4) for i in range(4, 8)] == [3, 2, 1, 0]


def test_snake_round_two_ascending_again():
    assert [seat_at(i, 4) for i in range(8, 12)] == [0, 1, 2, 3]


def test_round_at_one_indexed():
    assert round_at(0, 4) == 1
    assert round_at(3, 4) == 1
    assert round_at(4, 4) == 2


def test_round_robin_never_reverses_matches_doc_example():
    # GAME-RULES.md §2.2: 4 seats, round 1 = [0,1,2,3], round 2 = [1,2,3,0], round 3 = [2,3,0,1]
    assert seat_order(1, 4) == [0, 1, 2, 3]
    assert seat_order(2, 4) == [1, 2, 3, 0]
    assert seat_order(3, 4) == [2, 3, 0, 1]


def test_round_robin_two_seats():
    assert seat_order(1, 2) == [0, 1]
    assert seat_order(2, 2) == [1, 0]
    assert seat_order(3, 2) == [0, 1]
