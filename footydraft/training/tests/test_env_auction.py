import numpy as np
import pytest

from footydraft_sim.env_auction import AuctionEnv, PASS, RAISE5, WAIT
from footydraft_sim.players import load_pool
from footydraft_sim.scoring import POSITION_COEFFICIENTS
from footydraft_sim.squad import Squad


@pytest.fixture(scope="module")
def pool():
    return load_pool()


def run_random_episode(pool, rng, config=None):
    env = AuctionEnv(pool)
    env.reset(rng, config=config)
    steps = 0
    max_steps = 15 * env.seat_count * 60 + env.seat_count * 200
    while not env.done():
        mask = env.legal_action_mask()
        assert mask.any()
        legal = np.nonzero(mask)[0]
        action = int(legal[rng.integers(len(legal))])
        env.step(action)
        steps += 1
        assert steps <= max_steps, "episode did not terminate"
    return env


def test_many_random_episodes_terminate_and_backfill_completes(pool):
    rng = np.random.default_rng(0)
    total_backfill_failures = 0
    total_safety_cap_hits = 0
    for _ in range(15):
        env = run_random_episode(pool, rng)
        assert env.done()
        total_backfill_failures += env.backfill_failures
        total_safety_cap_hits += env.safety_cap_hits
        if env.backfill_failures == 0:
            for seat in range(env.seat_count):
                assert env.squads[seat].is_full()
    assert total_backfill_failures == 0
    assert total_safety_cap_hits == 0


def test_no_player_owned_by_more_than_one_seat(pool):
    rng = np.random.default_rng(1)
    env = run_random_episode(pool, rng)
    all_owned = []
    for squad in env.squads:
        all_owned += list(squad.slot_occupant.values())
        all_owned += list(squad.graveyard)
    assert len(all_owned) == len(set(all_owned))


def test_budgets_never_go_negative(pool):
    rng = np.random.default_rng(2)
    for _ in range(15):
        env = run_random_episode(pool, rng)
        assert (env.budgets >= 0).all()


def test_reward_matches_squad_score_at_finalization(pool):
    rng = np.random.default_rng(3)
    env = AuctionEnv(pool)
    env.reset(rng)
    seen = {}
    steps = 0
    max_steps = 15 * env.seat_count * 60 + env.seat_count * 200
    while not env.done():
        mask = env.legal_action_mask()
        legal = np.nonzero(mask)[0]
        action = int(legal[rng.integers(len(legal))])
        rewards = env.step(action)
        for s, r in rewards.items():
            assert s not in seen
            seen[s] = r
        steps += 1
        assert steps <= max_steps
    assert len(seen) == env.seat_count
    for seat in range(env.seat_count):
        assert abs(seen[seat] - env.squads[seat].score(pool)) < 1e-6


def test_lockout_blocks_raises_on_the_tick_right_after_a_bid(pool):
    rng = np.random.default_rng(4)
    env = AuctionEnv(pool)
    env.reset(rng)
    assert env.stage == "bidding"
    # Right after a lot opens, lockout is active.
    mask = env.legal_action_mask()
    assert mask[PASS] and mask[WAIT]
    assert not mask[RAISE5]

    # Advance past the opening lockout without raising, then force a raise, then
    # check the very next dispatched seat is locked out again.
    while env.stage == "bidding" and env.lockout_active:
        env.step(WAIT)
    mask = env.legal_action_mask()
    if mask[RAISE5]:
        env.step(RAISE5)
        assert env.stage != "bidding" or env.lockout_active  # either closed instantly or freshly locked
        if env.stage == "bidding":
            mask_after = env.legal_action_mask()
            assert not mask_after[RAISE5]


def test_no_raise_streak_eventually_closes_a_lot_under_all_wait(pool):
    # If every eligible seat just WAITs forever, the lot must still close (timeout
    # proxy) rather than hang -- this is the termination guarantee the safety cap
    # exists to backstop, but it should never be needed for this to hold.
    rng = np.random.default_rng(5)
    env = AuctionEnv(pool)
    env.reset(rng)
    first_cursor = env.cursor
    steps = 0
    while env.stage == "bidding" and env.cursor == first_cursor and steps < 1000:
        env.step(WAIT)
        steps += 1
    assert env.safety_cap_hits == 0
    assert steps < 1000  # closed well before the defensive cap


def test_swap_phase_lets_a_seat_promote_a_better_graveyard_player():
    # Direct, deterministic test of the swap mechanic in isolation: seed a seat with a
    # full, realistic 11-slot post-backfill squad (every slot occupied, matching the
    # actual game flow -- swap phase only ever starts after backfill guarantees this)
    # plus one graveyard CB better than its current cb-l, then confirm choosing that
    # graveyard player's action index performs the swap and nothing else changes.
    from footydraft_sim.formation import POSITION_CODES, SLOTS
    from footydraft_sim.players import PlayerPool

    position_index = {p: i for i, p in enumerate(POSITION_CODES)}
    n_slots = len(SLOTS)  # 11: one filler occupant per slot, correctly positioned
    n = n_slots + 1  # + one spare CB in the graveyard
    positions = [pos for (_slot_id, pos) in SLOTS]
    abilities = [10.0 + i for i in range(n_slots)] + [90.0]  # last entry: the strong spare
    spare_idx = n_slots

    tiny_pool = PlayerPool(
        name=[f"occupant_{i}" for i in range(n_slots)] + ["strong_cb_spare"],
        club_slug=["c"] * n,
        nation=["n"] * n,
        ability=np.array(abilities, dtype=np.float32),
        price=np.full(n, 20.0, dtype=np.float32),
        opening_bid=np.full(n, 15.0, dtype=np.float32),
        position_idx=np.array([position_index[p] for p in positions] + [position_index["CB"]], dtype=np.int8),
        league_idx=np.full(n, -1, dtype=np.int8),
        club_idx=np.zeros(n, dtype=np.int32),
        nation_idx=np.zeros(n, dtype=np.int32),
        club_names=["c"],
        nation_names=["n"],
    )
    env = AuctionEnv(tiny_pool)
    env.seat_count = 1
    env.squads = [Squad()]
    env.finalized = [False]
    env._pending = {}
    squad = env.squads[0]
    for i, (slot_id, _pos) in enumerate(SLOTS):
        squad.slot_occupant[slot_id] = i  # occupant_i, ability 10+i
    cb_l_original = squad.slot_occupant["cb-l"]
    cb_r_original = squad.slot_occupant["cb-r"]
    squad.graveyard = [spare_idx]  # strong_cb_spare (ability 90), unused
    score_before = squad.score(tiny_pool)

    env.stage = "swap"
    env.swap_seat = 0
    env._enter_swap_seat()

    assert env.acting_seat() == 0
    assert env._current_swap_slot == "cb-l"  # formation order: cb-l is checked before cb-r
    mask = env.legal_action_mask()
    assert mask[cb_l_original] and mask[spare_idx]
    assert mask.sum() == 2  # only "keep current" or "take the one spare" are legal

    rewards = env.step(spare_idx)  # choose to bring in the stronger spare

    assert squad.slot_occupant["cb-l"] == spare_idx
    assert cb_l_original in squad.graveyard

    # The just-displaced weak cb-l (ability 10) now sits in the graveyard and is
    # itself CB-eligible, so cb-r is correctly re-offered a (bad) swap -- the env
    # doesn't auto-resolve that as "obviously not worth it," the policy must. Decline
    # every further offer (keep current occupant) until the seat's swap phase ends.
    while not env.done():
        mask = env.legal_action_mask()
        current_occupant = squad.slot_occupant[env._current_swap_slot]
        assert mask[current_occupant]
        rewards = env.step(current_occupant)

    assert squad.slot_occupant["cb-r"] == cb_r_original  # declined every further offer -- untouched
    expected_score = score_before - abilities[cb_l_original] * POSITION_COEFFICIENTS["CB"] + abilities[spare_idx] * POSITION_COEFFICIENTS["CB"]
    assert abs(rewards[0] - expected_score) < 1e-6
    assert abs(squad.score(tiny_pool) - expected_score) < 1e-6
