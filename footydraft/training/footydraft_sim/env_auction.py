"""Auction (GAME-RULES.md §3). Not turn-based in the real game -- any seat may bid at
any time, gated only by a 3s post-bid lockout and a 15s inactivity clock. This env
discretizes that into one decision per seat per tick, documented in full in
footydraft/training/README.md; the short version:

  - Each lot dispatches acting seats one at a time in a randomly-shuffled rotation
    (reshuffled whenever it empties), so no seat is systematically favored by the
    discretization itself.
  - The 3s lockout becomes: the seat dispatched immediately after any lot-open or
    accepted bid may not raise (pass/wait only); it clears after that one seat-turn.
  - The 15s inactivity clock becomes: the lot closes once `no_raise_streak` (ticks
    since the last accepted raise) reaches the number of seats currently eligible to
    act on it -- i.e., everyone who could raise has had a chance since the last bid
    and declined. lotIsDecided() (GAME-RULES.md §3.6) is checked after every tick and
    closes the lot immediately when it fires, exactly as in the source.
  - WAIT (distinct from PASS) exists because passing is final in the source; an agent
    that isn't ready to commit either way needs a way to let a tick pass without
    burning its seat.

Backfill (§3.8) is applied automatically, exactly as the engine does it -- it is a
forced rule of the game, not a choice available to any seat, so it is not modeled as
an action.

The post-draft swap (§3.7) IS a real player-controlled action in the source ("all that
is left of post-draft editing"), so unlike backfill it is NOT auto-resolved here: each
seat gets an explicit swap phase (see _enter_swap_seat/_advance_swap_slot_cursor) where
it must actually choose, slot by slot, whether to keep the current occupant or bring in
a graveyard player of the same position -- repeated in passes until a full pass changes
nothing, capped at MAX_SWAP_STEPS. Nothing about the final score is pre-solved for it.
"""

import numpy as np

from .formation import POSITION_CODES, SLOTS
from .js_compat import js_round
from .observation import CANDIDATE_FEATURE_LEN, CONTEXT_LEN, MAX_OPPONENTS, encode_candidates, encode_context
from .sampling import draw_skewed
from .squad import Squad
from .viability import sample_random_config

_POSITION_INDEX = {p: i for i, p in enumerate(POSITION_CODES)}

PASS, WAIT, RAISE5, RAISE10, RAISE25 = range(5)
N_BIDDING_ACTIONS = 5
_RAISE_STEP = {RAISE5: 5.0, RAISE10: 10.0, RAISE25: 25.0}

BUDGET_SCALE = 2000.0
BIDDING_EXTRA_LEN = CANDIDATE_FEATURE_LEN + 2 + 2 + 1 + 1 + 1 + MAX_OPPONENTS
BIDDING_OBS_LEN = CONTEXT_LEN + BIDDING_EXTRA_LEN

LOTS_PER_DRAFTER = 15
SAFETY_TICK_CAP = 500  # defensive only -- normal play always closes well before this
MAX_SWAP_STEPS = 44  # ~4 full passes over 11 slots


class AuctionEnv:
    def __init__(self, pool):
        self.pool = pool

    def reset(self, rng: np.random.Generator, config=None):
        self.rng = rng
        self.config = config or sample_random_config(rng, "auction")
        assert self.config.format == "auction"
        self.seat_count = self.config.seat_count
        self.scoped = np.nonzero(self.pool.in_scope(self.config.scope, self.config.league))[0]

        avg_price = float(self.pool.price[self.scoped].mean())
        self.budget_value = max(100.0, js_round(avg_price * 19.0 / 100.0) * 100.0)
        self.budgets = np.full(self.seat_count, self.budget_value, dtype=np.float64)

        self.lot_list = self._build_lot_list(rng)
        self.cursor = 0
        self.squads = [Squad() for _ in range(self.seat_count)]
        self.finalized = [False] * self.seat_count
        self._pending = {}
        self.safety_cap_hits = 0
        self.backfill_failures = 0

        self.stage = "bidding"
        self._open_next_lot()
        rewards, self._pending = self._pending, {}
        return rewards

    # ---- lot list construction --------------------------------------------

    def _build_lot_list(self, rng: np.random.Generator) -> list:
        claimed: set = set()
        lots: list = []
        for _slot_id, position in SLOTS:
            pos_mask = self.pool.position_idx[self.scoped] == _POSITION_INDEX[position]
            avail = self.scoped[pos_mask]
            if claimed:
                avail = avail[~np.isin(avail, np.fromiter(claimed, dtype=np.int64))]
            drawn = draw_skewed(rng, avail, self.pool.ability, self.seat_count)
            claimed.update(drawn.tolist())
            lots.extend(drawn.tolist())

        remaining = self.scoped[~np.isin(self.scoped, np.fromiter(claimed, dtype=np.int64))]
        surplus = draw_skewed(rng, remaining, self.pool.ability, 4 * self.seat_count)
        lots.extend(surplus.tolist())

        lots_arr = np.asarray(lots, dtype=np.int64)
        rng.shuffle(lots_arr)
        return [{"player_idx": int(p), "opening": float(self.pool.opening_bid[p])} for p in lots_arr]

    # ---- bidding phase ------------------------------------------------------

    def _auction_exhausted(self) -> bool:
        if self.cursor >= len(self.lot_list):
            return True
        has_open_slot = [len(self.squads[s].slot_occupant) < 11 for s in range(self.seat_count)]
        if not any(has_open_slot):
            return True
        min_remaining_opening = min(lot["opening"] for lot in self.lot_list[self.cursor :])
        return not any(self.budgets[s] >= min_remaining_opening for s in range(self.seat_count) if has_open_slot[s])

    def _open_next_lot(self) -> None:
        while not self._auction_exhausted():
            self.lot_price = self.lot_list[self.cursor]["opening"]
            self.lot_holder = None
            self.lot_out: set = set()
            self.turn_queue: list = []
            self.no_raise_streak = 0
            self.lockout_active = True
            self.lot_tick_count = 0
            self._dispatch_bidder()
            return
        self._start_backfill()

    def _eligible_count(self) -> int:
        return self.seat_count - len(self.lot_out) - (0 if self.lot_holder is None else 1)

    def _dispatch_bidder(self) -> None:
        self.lot_tick_count += 1
        if self.lot_tick_count > SAFETY_TICK_CAP:
            self.safety_cap_hits += 1
            self._close_lot()
            return
        if not self.turn_queue:
            eligible = [s for s in range(self.seat_count) if s != self.lot_holder and s not in self.lot_out]
            self.rng.shuffle(eligible)
            self.turn_queue = eligible
        self._acting_seat = self.turn_queue.pop(0)

    def _bidding_legal_mask(self) -> np.ndarray:
        mask = np.zeros(N_BIDDING_ACTIONS, dtype=bool)
        mask[PASS] = True
        mask[WAIT] = True
        if self.lockout_active:
            return mask
        budget = self.budgets[self._acting_seat]
        for action, step in _RAISE_STEP.items():
            new_price = self.lot_list[self.cursor]["opening"] if self.lot_holder is None else self.lot_price + step
            mask[action] = new_price <= budget
        return mask

    def _step_bidding(self, action: int) -> None:
        seat = self._acting_seat
        if action == PASS:
            self.lot_out.add(seat)
            self.no_raise_streak += 1
            self.lockout_active = False
        elif action == WAIT:
            self.no_raise_streak += 1
            self.lockout_active = False
        else:
            new_price = self.lot_list[self.cursor]["opening"] if self.lot_holder is None else self.lot_price + _RAISE_STEP[action]
            self.lot_price = new_price
            self.lot_holder = seat
            self.no_raise_streak = 0
            self.lockout_active = True

        standing = self.seat_count - len(self.lot_out)
        decided = (standing <= 0) if self.lot_holder is None else (standing <= 1)
        if decided or self.no_raise_streak >= self._eligible_count():
            self._close_lot()
        else:
            self._dispatch_bidder()

    def _close_lot(self) -> None:
        lot = self.lot_list[self.cursor]
        if self.lot_holder is not None:
            buyer = self.lot_holder
            self.budgets[buyer] -= self.lot_price
            position = POSITION_CODES[self.pool.position_idx[lot["player_idx"]]]
            slot = self.squads[buyer].assign(position, lot["player_idx"])
            if slot is None:
                self.squads[buyer].graveyard.append(lot["player_idx"])
        self.cursor += 1
        self._open_next_lot()

    # ---- backfill (automatic, not an action) --------------------------------

    def _start_backfill(self) -> None:
        taken_mask = np.zeros(self.pool.size, dtype=bool)
        for squad in self.squads:
            for idx in squad.slot_occupant.values():
                taken_mask[idx] = True
            for idx in squad.graveyard:
                taken_mask[idx] = True

        for seat in range(self.seat_count):
            for slot_id, position in SLOTS:
                if slot_id in self.squads[seat].slot_occupant:
                    continue
                candidate = self._weakest_for(position, taken_mask)
                if candidate is not None:
                    self.squads[seat].slot_occupant[slot_id] = candidate
                    taken_mask[candidate] = True
                else:
                    # Scoped pool truly exhausted for this position -- leave the slot
                    # open rather than crash; the doc claims this never happens at any
                    # offered lobby size for this dataset (verified empirically below).
                    self.backfill_failures += 1

        self._start_swap_phase()

    def _weakest_for(self, position: str, taken_mask: np.ndarray):
        pos_mask = self.pool.position_idx[self.scoped] == _POSITION_INDEX[position]
        candidates = self.scoped[pos_mask & ~taken_mask[self.scoped]]
        if len(candidates) == 0:
            return None
        return int(candidates[np.argmin(self.pool.ability[candidates])])

    # ---- swap phase (explicit action, see module docstring) -----------------

    def _start_swap_phase(self) -> None:
        self.stage = "swap"
        self.swap_seat = 0
        self._enter_swap_seat()

    def _enter_swap_seat(self) -> None:
        while self.swap_seat < self.seat_count:
            self.swap_step_count = 0
            self.swap_changed_this_pass = False
            self.swap_slot_cursor = 0
            if self._advance_swap_slot_cursor():
                self._acting_seat = self.swap_seat
                return
            self._finalize(self.swap_seat)
            self.swap_seat += 1
        self._acting_seat = None
        self.stage = "done"

    def _advance_swap_slot_cursor(self) -> bool:
        """Move to the next slot (within the current pass) with >=1 eligible graveyard
        candidate. Wraps into a new pass if the current one changed anything; returns
        False once a full pass changes nothing, or the step cap is hit."""
        squad = self.squads[self.swap_seat]
        while True:
            if self.swap_step_count >= MAX_SWAP_STEPS:
                return False
            if self.swap_slot_cursor >= len(SLOTS):
                if not self.swap_changed_this_pass:
                    return False
                self.swap_changed_this_pass = False
                self.swap_slot_cursor = 0
                continue
            slot_id, position = SLOTS[self.swap_slot_cursor]
            candidates = [gi for gi in squad.graveyard if POSITION_CODES[self.pool.position_idx[gi]] == position]
            if candidates:
                self._current_swap_slot = slot_id
                self._current_swap_candidates = candidates
                return True
            self.swap_slot_cursor += 1

    def _swap_legal_mask(self) -> np.ndarray:
        mask = np.zeros(self.pool.size, dtype=bool)
        squad = self.squads[self.swap_seat]
        mask[squad.slot_occupant[self._current_swap_slot]] = True  # "stay" == re-selecting the current occupant
        for gi in self._current_swap_candidates:
            mask[gi] = True
        return mask

    def _step_swap(self, action: int) -> None:
        seat = self.swap_seat
        squad = self.squads[seat]
        slot_id = self._current_swap_slot
        current_occupant = squad.slot_occupant[slot_id]
        if action != current_occupant:
            squad.slot_occupant[slot_id] = action
            squad.graveyard.remove(action)
            squad.graveyard.append(current_occupant)
            self.swap_changed_this_pass = True
        self.swap_step_count += 1
        self.swap_slot_cursor += 1
        if self._advance_swap_slot_cursor():
            self._acting_seat = seat  # unchanged; next decision for the same seat
        else:
            self._finalize(seat)
            self.swap_seat += 1
            self._enter_swap_seat()

    def _finalize(self, seat: int) -> None:
        self.finalized[seat] = True
        self._pending[seat] = self.squads[seat].score(self.pool)

    # ---- public env interface ------------------------------------------------

    def acting_seat(self):
        return self._acting_seat

    def action_kind(self) -> str:
        return "bidding" if self.stage == "bidding" else "swap"

    def legal_action_mask(self) -> np.ndarray:
        if self.stage == "bidding":
            return self._bidding_legal_mask()
        return self._swap_legal_mask()

    def observe(self, seat: int) -> dict:
        if self.stage == "bidding":
            return self._observe_bidding(seat)
        return self._observe_swap(seat)

    def _observe_bidding(self, seat: int) -> dict:
        context = encode_context(self.pool, seat, self.squads, self.seat_count, self.cursor, len(self.lot_list), None)
        lot = self.lot_list[self.cursor]
        lot_features = encode_candidates(self.pool, np.array([lot["player_idx"]]), None, None)[0]

        order = [(seat + 1 + k) % self.seat_count for k in range(self.seat_count - 1)]
        opp_budgets = [self.budgets[order[k]] / BUDGET_SCALE if k < len(order) else 0.0 for k in range(MAX_OPPONENTS)]

        extra = np.concatenate(
            [
                lot_features,
                [self.lot_price / BUDGET_SCALE, lot["opening"] / BUDGET_SCALE],
                [1.0 if self.lot_holder == seat else 0.0, 1.0 if self.lot_holder is None else 0.0],
                [(self.seat_count - len(self.lot_out)) / self.seat_count],
                [1.0 if self.lockout_active else 0.0],
                [self.budgets[seat] / BUDGET_SCALE],
                opp_budgets,
            ]
        ).astype(np.float32)
        features = np.concatenate([context, extra])
        assert features.shape == (BIDDING_OBS_LEN,)
        return {"features": features}

    def _observe_swap(self, seat: int) -> dict:
        context = encode_context(self.pool, seat, self.squads, self.seat_count, self.cursor, len(self.lot_list), None)
        candidate_indices = np.asarray(sorted(self.legal_action_mask().nonzero()[0].tolist()), dtype=np.int64)
        candidate_features = encode_candidates(self.pool, candidate_indices, None, None)
        return {"context": context, "candidate_indices": candidate_indices, "candidate_features": candidate_features}

    def step(self, action: int) -> dict:
        assert self._acting_seat is not None, "step() called after episode end"
        mask = self.legal_action_mask()
        assert mask[action], "illegal action"

        if self.stage == "bidding":
            self._step_bidding(action)
        else:
            self._step_swap(action)

        rewards, self._pending = self._pending, {}
        return rewards

    def done(self) -> bool:
        return self.stage == "done"
