import numpy as np
import pytest

from footydraft_sim.env_deal_or_no_deal import GO_BACK, HEAR_OFFER, STICK, TAKE_OFFER, DealOrNoDealEnv
from footydraft_sim.order import seat_order
from footydraft_sim.players import PlayerPool, load_pool
from footydraft_sim.squad import Squad


@pytest.fixture(scope="module")
def pool():
    return load_pool()


def run_random_episode(pool, rng, config=None):
    env = DealOrNoDealEnv(pool)
    env.reset(rng, config=config)
    steps = 0
    max_steps = 11 * 5 * 2 + 50  # opening + offer decisions, generously bounded
    while not env.done():
        mask = env.legal_action_mask()
        assert mask.any()
        legal = np.nonzero(mask)[0]
        action = int(legal[rng.integers(len(legal))])
        env.step(action)
        steps += 1
        assert steps <= max_steps, "episode did not terminate"
    return env


def test_many_random_episodes_terminate_and_squads_are_valid(pool):
    rng = np.random.default_rng(0)
    total_shortages = 0
    for _ in range(30):
        env = run_random_episode(pool, rng)
        assert env.done()
        total_shortages += env.box_shortage_dead_ends
        if env.box_shortage_dead_ends == 0:
            for seat in range(env.seat_count):
                assert env.squads[seat].is_full()
    assert total_shortages == 0  # never expected against this pool's real position depth


def test_no_player_drafted_twice(pool):
    rng = np.random.default_rng(1)
    env = run_random_episode(pool, rng)
    all_picks = [p for squad in env.squads for p in squad.slot_occupant.values()]
    assert len(all_picks) == len(set(all_picks))


def test_reward_matches_squad_score_at_finalization(pool):
    rng = np.random.default_rng(2)
    env = DealOrNoDealEnv(pool)
    env.reset(rng)
    seen = {}
    while not env.done():
        mask = env.legal_action_mask()
        legal = np.nonzero(mask)[0]
        action = int(legal[rng.integers(len(legal))])
        rewards = env.step(action)
        for s, r in rewards.items():
            assert s not in seen
            seen[s] = r
    assert len(seen) == env.seat_count
    for seat in range(env.seat_count):
        assert abs(seen[seat] - env.squads[seat].score(pool)) < 1e-6


def test_opening_stage_follows_round_robin_never_reverses(pool):
    rng = np.random.default_rng(3)
    env = DealOrNoDealEnv(pool)
    env.reset(rng, config=None)
    # Force everyone to STICK so each round's opening-stage acting-seat sequence is
    # observable start to finish with no offer-stage detour.
    seen_round_orders = []
    current_round_seats = []
    last_round_number = env.round_number
    steps = 0
    while not env.done() and steps < 200:
        if env.round_number != last_round_number:
            seen_round_orders.append((last_round_number, current_round_seats))
            current_round_seats = []
            last_round_number = env.round_number
        current_round_seats.append(env.acting_seat())
        env.step(STICK)
        steps += 1
    if current_round_seats:
        seen_round_orders.append((last_round_number, current_round_seats))

    for round_number, seats in seen_round_orders:
        assert seats == seat_order(round_number, env.seat_count)


def _tiny_gk_only_pool(n_gk: int) -> PlayerPool:
    """A synthetic pool with exactly n_gk goalkeepers and nothing else -- lets a test
    force the 'too few real candidates to name' stranding branch deterministically:
    if boxes consume every GK in the pool, the banker has zero candidates left."""
    return PlayerPool(
        name=[f"gk{i}" for i in range(n_gk)],
        club_slug=["club"] * n_gk,
        nation=["nation"] * n_gk,
        ability=np.array([10.0 * (i + 1) for i in range(n_gk)], dtype=np.float32),
        price=np.full(n_gk, 50.0, dtype=np.float32),
        opening_bid=np.full(n_gk, 35.0, dtype=np.float32),
        position_idx=np.zeros(n_gk, dtype=np.int8),  # GK is index 0 in POSITION_CODES
        league_idx=np.full(n_gk, -1, dtype=np.int8),
        club_idx=np.zeros(n_gk, dtype=np.int32),
        nation_idx=np.zeros(n_gk, dtype=np.int32),
        club_names=["club"],
        nation_names=["nation"],
    )


def test_stranded_seat_keeps_its_originally_revealed_player():
    # seat_count=2 needs 2*2=4 boxes; with exactly 4 GKs in the whole pool, every GK
    # ends up inside this round's box set, so if both seats hear the offer, the
    # banker has zero eligible candidates left to name -- guaranteed stranding.
    tiny_pool = _tiny_gk_only_pool(4)
    env = DealOrNoDealEnv(tiny_pool)
    env.rng = np.random.default_rng(0)
    env.config = None
    env.seat_count = 2
    env.scoped = np.arange(tiny_pool.size)
    env.round_positions = ["GK"] * 11
    env.taken = np.zeros(tiny_pool.size, dtype=bool)
    env.squads = [Squad(), Squad()]
    env.finalized = [False, False]
    env.picks_made = 0
    env.total_picks = 22
    env.box_shortage_dead_ends = 0
    env._pending = {}
    env.round_number = 0
    env.stage = "opening"
    env._acting_seat = None
    env._start_round()

    assert env.acting_seat() == 0
    fallback_seat0 = env.revealed
    env.step(HEAR_OFFER)

    assert env.acting_seat() == 1
    fallback_seat1 = env.revealed
    env.step(HEAR_OFFER)  # cascades: offer resolution -- 0 real candidates left -> both stranded

    # Round 1 resolves synchronously inside that step() call (both seats already had
    # their one decision each), so both squads are assigned before round 2 even
    # starts, regardless of what round 2 goes on to do.
    assert env.squads[0].slot_occupant["gk"] == fallback_seat0
    assert env.squads[1].slot_occupant["gk"] == fallback_seat1


def test_go_back_masked_when_no_sealed_boxes_remain(pool):
    rng = np.random.default_rng(5)
    env = DealOrNoDealEnv(pool)
    env.reset(rng)
    steps = 0
    while not env.done() and steps < 500:
        mask = env.legal_action_mask()
        if env.stage == "offer":
            assert mask[TAKE_OFFER]
            if len(env.sealed) == 0:
                assert not mask[GO_BACK]
        legal = np.nonzero(mask)[0]
        action = int(legal[rng.integers(len(legal))])
        env.step(action)
        steps += 1
