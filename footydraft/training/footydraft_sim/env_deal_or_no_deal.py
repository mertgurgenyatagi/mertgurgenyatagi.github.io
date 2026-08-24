"""Deal or No Deal (GAME-RULES.md §8). 11 rounds, one per formation slot, shuffled
once at draft start; round-robin turn order that never reverses (dondEngine.ts's own
comment: draftEngine.ts's seatAt "is explicitly wrong here").

Two simplifications from the real-time UI, both strategically inert (see
footydraft/training/README.md):
  - WHICH sealed box index a seat opens is not modeled as a decision: box identity is
    exchangeable (every box in a round is drawn from the same distribution), so the
    env just pops a uniformly random still-sealed box. The two decisions that DO carry
    strategy -- stick vs hear the offer, and take the offer vs go back -- are the only
    ones exposed as actions.
  - REVEAL_HOLD/ROUND_HOLD (animation pacing) aren't simulated.

Action space (fixed, 4-way, masked by stage): STICK, HEAR_OFFER during the opening
sub-stage; TAKE_OFFER, GO_BACK during the offer sub-stage (GO_BACK further masked out
once no sealed boxes remain).
"""

import numpy as np

from .formation import POSITION_CODES, SLOTS
from .observation import ABILITY_SCALE, CONTEXT_LEN, PRICE_SCALE, encode_context
from .order import seat_order
from .sampling import draw_skewed
from .squad import Squad
from .viability import sample_random_config

ACTION_KIND = "discrete"
N_ACTIONS = 4
STICK, HEAR_OFFER, TAKE_OFFER, GO_BACK = range(4)

_POSITION_INDEX = {p: i for i, p in enumerate(POSITION_CODES)}
EXTRA_FEATURE_LEN = 2 + len(POSITION_CODES) + 5  # stage + round-position one-hot + 5 scalars
OBS_LEN = CONTEXT_LEN + EXTRA_FEATURE_LEN


class DealOrNoDealEnv:
    def __init__(self, pool):
        self.pool = pool

    def reset(self, rng: np.random.Generator, config=None):
        self.rng = rng
        self.config = config or sample_random_config(rng, "deal-or-no-deal")
        assert self.config.format == "deal-or-no-deal"
        self.seat_count = self.config.seat_count
        self.scoped = np.nonzero(self.pool.in_scope(self.config.scope, self.config.league))[0]

        round_positions = [pos for (_slot_id, pos) in SLOTS]
        rng.shuffle(round_positions)
        self.round_positions = round_positions

        self.taken = np.zeros(self.pool.size, dtype=bool)
        self.squads = [Squad() for _ in range(self.seat_count)]
        self.finalized = [False] * self.seat_count
        self.picks_made = 0
        self.total_picks = 11 * self.seat_count
        self.box_shortage_dead_ends = 0
        self._pending = {}

        self.round_number = 0
        self.stage = "opening"
        self._acting_seat = None
        self._start_round()
        rewards, self._pending = self._pending, {}
        return rewards

    # ---- round lifecycle ---------------------------------------------------

    def _start_round(self) -> None:
        self.round_number += 1
        self.round_position = self.round_positions[self.round_number - 1]

        pos_mask = self.pool.position_idx[self.scoped] == _POSITION_INDEX[self.round_position]
        candidates = self.scoped[pos_mask & ~self.taken[self.scoped]]
        boxes = draw_skewed(self.rng, candidates, self.pool.ability, 2 * self.seat_count)

        if len(boxes) < self.seat_count:
            # Position too thin in this scope to give every acting seat a box this
            # round -- shouldn't happen for a viability-sampled config against this
            # pool (verified empirically in tests), but end the draft cleanly on
            # whatever squads exist rather than crash on an empty pop.
            self.box_shortage_dead_ends += 1
            for seat in range(self.seat_count):
                if not self.finalized[seat]:
                    self._finalize(seat)
            self._acting_seat = None
            self.stage = "done"
            return

        self.round_box_occupants = set(boxes.tolist())
        self.sealed = list(boxes)
        self.order = seat_order(self.round_number, self.seat_count)
        self.order_cursor = 0
        self.stage = "opening"
        self.hearing = []  # [(seat, fallback_player_idx), ...]
        self.round_picks = {}

        self._advance_opening()

    def _pop_random_sealed(self) -> int:
        pos = int(self.rng.integers(len(self.sealed)))
        return self.sealed.pop(pos)

    def _advance_opening(self) -> None:
        if self.order_cursor >= len(self.order):
            self._resolve_offers_or_finish_round()
            return
        seat = self.order[self.order_cursor]
        self.revealed = self._pop_random_sealed()
        self._acting_seat = seat

    def _resolve_offers_or_finish_round(self) -> None:
        if not self.hearing:
            self._finish_round()
            return

        target = float(self.pool.ability[self.sealed].mean())
        pos_mask = self.pool.position_idx[self.scoped] == _POSITION_INDEX[self.round_position]
        excluded = np.isin(self.scoped, list(self.round_box_occupants)) | self.taken[self.scoped]
        banker_pool = self.scoped[pos_mask & ~excluded]
        ranked = banker_pool[np.argsort(np.abs(self.pool.ability[banker_pool] - target))]

        n_named = min(len(self.hearing), len(ranked))
        self.named_offers = {seat: int(ranked[i]) for i, (seat, _fallback) in enumerate(self.hearing[:n_named])}

        for seat, fallback in self.hearing[n_named:]:  # stranded: too few real candidates to name
            self.round_picks[seat] = fallback
            self.taken[fallback] = True

        self.offer_cursor = 0
        self.stage = "offer"
        self._advance_offer()

    def _advance_offer(self) -> None:
        while self.offer_cursor < len(self.hearing):
            seat, _fallback = self.hearing[self.offer_cursor]
            if seat in self.named_offers:
                self._acting_seat = seat
                return
            self.offer_cursor += 1
        self._finish_round()

    def _finish_round(self) -> None:
        for seat, player_idx in self.round_picks.items():
            slot = self.squads[seat].assign(self.round_position, player_idx)
            assert slot is not None
            self.picks_made += 1
            if self.squads[seat].is_full():
                self._finalize(seat)

        if self.round_number >= 11 or all(self.finalized):
            self._acting_seat = None
            self.stage = "done"
            return
        self._start_round()

    def _finalize(self, seat: int) -> None:
        self.finalized[seat] = True
        self._pending[seat] = self.squads[seat].score(self.pool)

    # ---- public env interface ----------------------------------------------

    def acting_seat(self):
        return self._acting_seat

    def legal_action_mask(self) -> np.ndarray:
        mask = np.zeros(N_ACTIONS, dtype=bool)
        if self.stage == "opening":
            mask[STICK] = True
            mask[HEAR_OFFER] = True
        elif self.stage == "offer":
            mask[TAKE_OFFER] = True
            mask[GO_BACK] = len(self.sealed) > 0
        return mask

    def observe(self, seat: int) -> dict:
        context = encode_context(
            self.pool, seat, self.squads, self.seat_count, self.picks_made, self.total_picks, None
        )
        stage_onehot = [1.0, 0.0] if self.stage == "opening" else [0.0, 1.0]
        position_onehot = [1.0 if p == self.round_position else 0.0 for p in POSITION_CODES]

        if self.stage == "opening":
            original_idx = current_idx = self.revealed
        else:
            original_idx = dict(self.hearing)[seat]
            current_idx = self.named_offers[seat]

        extra = stage_onehot + position_onehot + [
            float(self.pool.ability[original_idx]) / ABILITY_SCALE,
            float(self.pool.ability[current_idx]) / ABILITY_SCALE,
            float(self.pool.price[current_idx]) / PRICE_SCALE,
            len(self.sealed) / (2 * self.seat_count),
            self.round_number / 11.0,
        ]
        features = np.concatenate([context, np.asarray(extra, dtype=np.float32)])
        assert features.shape == (OBS_LEN,)
        return {"features": features}

    def step(self, action: int) -> dict:
        seat = self._acting_seat
        assert seat is not None, "step() called after episode end"
        mask = self.legal_action_mask()
        assert mask[action], "illegal action"

        if self.stage == "opening":
            if action == STICK:
                self.round_picks[seat] = self.revealed
                self.taken[self.revealed] = True
            else:
                self.hearing.append((seat, self.revealed))
            self.order_cursor += 1
            self._advance_opening()
        else:
            if action == TAKE_OFFER:
                chosen = self.named_offers[seat]
            else:
                chosen = self._pop_random_sealed()
            self.round_picks[seat] = chosen
            self.taken[chosen] = True
            self.offer_cursor += 1
            self._advance_offer()

        rewards, self._pending = self._pending, {}
        return rewards

    def done(self) -> bool:
        return self.stage == "done"
