"""Spin the Wheel (GAME-RULES.md §9). The pick itself is a plain Free Pick — same
snake order, same slot gate, no constraint ever applied — restricted each turn to
whatever the wheel landed on. Category (league|club) is fixed once for the whole
draft; which slices are 'live' is recomputed every turn for the seat on the clock
(an entity with no legal player for their current squad simply isn't offered).

The wheel spin itself carries no strategy (uniform random over live slices, GAME-
RULES.md §9.4) so it is not modeled as an agent action here, only as an env-internal
random draw — same treatment as DoND's blind box-index choice. The physical spin
animation/rotation math is cosmetic and is not simulated at all.
"""

import numpy as np

from .clubs_data import TOP_WHEEL_CLUBS
from .constraints import eligibility_mask
from .formation import POSITION_CODES
from .observation import encode_candidates, encode_context
from .order import seat_at
from .players import LEAGUE_IDS
from .squad import Squad
from .viability import sample_random_config

ACTION_KIND = "candidate"
OTHER_LEAGUE_ENTITY = len(LEAGUE_IDS)  # 5 -- 'Elsewhere', scope='all' only


def _category_for(scope: str, wheel_pref: str | None) -> str:
    if scope == "league":
        return "club"  # scope already fixed the league; wheel must be clubs
    return "club" if wheel_pref == "club" else "league"


class SpinWheelEnv:
    def __init__(self, pool):
        self.pool = pool
        club_to_wheel_slot = np.full(pool.n_clubs, -1, dtype=np.int32)
        for wheel_ordinal, slug in enumerate(TOP_WHEEL_CLUBS):
            if slug in pool.club_names:
                club_to_wheel_slot[pool.club_names.index(slug)] = wheel_ordinal
        self._club_to_wheel_slot = club_to_wheel_slot

    def reset(self, rng: np.random.Generator, config=None):
        self.rng = rng
        self.config = config or sample_random_config(rng, "spin-the-wheel")
        assert self.config.format == "spin-the-wheel"
        self.seat_count = self.config.seat_count
        self.scoped = np.nonzero(self.pool.in_scope(self.config.scope, self.config.league))[0]
        self.category = _category_for(self.config.scope, self.config.wheel)

        if self.category == "club":
            self.entity_key = self._club_to_wheel_slot[self.pool.club_idx]
        else:
            league_idx = self.pool.league_idx.astype(np.int32)
            if self.config.scope == "all":
                self.entity_key = np.where(league_idx >= 0, league_idx, OTHER_LEAGUE_ENTITY)
            else:
                self.entity_key = league_idx  # top-5 scope: non-top5 already excluded from `scoped`

        self.taken = np.zeros(self.pool.size, dtype=bool)
        self.squads = [Squad() for _ in range(self.seat_count)]
        self.finalized = [False] * self.seat_count
        self.overall = 0
        self.total_picks = 11 * self.seat_count
        self.stalled_dead_ends = 0
        self._pending = {}

        self._advance()
        rewards, self._pending = self._pending, {}
        return rewards

    def _eligible_scoped_mask(self, seat: int) -> np.ndarray:
        return eligibility_mask(self.pool, self.scoped, self.taken, self.squads[seat].filled_slots(), None, None)

    def _advance(self) -> None:
        while self.overall < self.total_picks:
            seat = seat_at(self.overall, self.seat_count)
            if self.finalized[seat]:
                self.overall += 1
                continue

            eligible = self._eligible_scoped_mask(seat)
            if not eligible.any():
                self.stalled_dead_ends += 1
                self._finalize(seat)
                self.overall += 1
                continue

            entity_of_eligible = self.entity_key[self.scoped[eligible]]
            live = np.unique(entity_of_eligible[entity_of_eligible >= 0])
            if len(live) == 0:
                # every eligible player belongs to no representable slice (category='club'
                # and none of the eligible players are in the top-15) -- can't spin to
                # anything; same dead-end treatment as a fully-blocked seat.
                self.stalled_dead_ends += 1
                self._finalize(seat)
                self.overall += 1
                continue

            landed = int(live[int(self.rng.integers(len(live)))])
            candidate_mask_scoped = eligible & (self.entity_key[self.scoped] == landed)
            full_mask = np.zeros(self.pool.size, dtype=bool)
            full_mask[self.scoped] = candidate_mask_scoped

            self._cached_seat = seat
            self._cached_mask = full_mask
            self._cached_landed_entity = landed
            return
        self._cached_seat = None
        self._cached_mask = None

    def _finalize(self, seat: int) -> float:
        reward = self.squads[seat].score(self.pool)
        self.finalized[seat] = True
        self._pending[seat] = reward
        return reward

    def acting_seat(self):
        return self._cached_seat

    def legal_action_mask(self) -> np.ndarray:
        return self._cached_mask

    def observe(self, seat: int) -> dict:
        context = encode_context(self.pool, seat, self.squads, self.seat_count, self.overall, self.total_picks, None)
        candidate_indices = np.nonzero(self._cached_mask)[0]
        candidate_features = encode_candidates(self.pool, candidate_indices, None, None)
        return {"context": context, "candidate_indices": candidate_indices, "candidate_features": candidate_features}

    def step(self, action: int) -> dict:
        seat = self._cached_seat
        assert seat is not None, "step() called after episode end"
        assert self._cached_mask[action], "illegal action"

        position = POSITION_CODES[self.pool.position_idx[action]]
        slot = self.squads[seat].assign(position, action)
        assert slot is not None
        self.taken[action] = True
        self.overall += 1

        if self.squads[seat].is_full():
            self._finalize(seat)

        self._advance()
        rewards, self._pending = self._pending, {}
        return rewards

    def done(self) -> bool:
        return self._cached_seat is None
