"""Free Pick: the baseline snake draft (GAME-RULES.md §4). Direct pick, no take-backs,
table-wide constraint (§5) is this format's one exclusive mechanic.

Real-game caveat this env deliberately does NOT reproduce: the live app has no
timeout/auto-pick on this screen (dead code, §0.1) and 'a draft CAN in fact end
incomplete' if a seat stalls. This env can't stall (every tick a policy acts
immediately) but a seat *can* still paint itself into a corner under a tight
constraint+scope (zero legal candidates while slots remain open) — matching that same
real possibility rather than inventing a rescue mechanic that doesn't exist in the
game. See _advance(): such a seat is finalized on whatever partial squad it has and
skipped for the rest of the draft. `stalled_dead_ends` counts how often this fires,
for training-time visibility.
"""

import numpy as np

from .constraints import TableSpend, eligibility_mask
from .formation import POSITION_CODES
from .observation import CANDIDATE_FEATURE_LEN, CONTEXT_LEN, encode_candidates, encode_context
from .order import seat_at
from .squad import Squad
from .viability import sample_random_config

ACTION_KIND = "candidate"  # action = a global player index


class FreePickEnv:
    def __init__(self, pool):
        self.pool = pool

    def reset(self, rng: np.random.Generator, config=None):
        self.rng = rng
        self.config = config or sample_random_config(rng, "free-pick")
        assert self.config.format == "free-pick"
        self.constraint = self.config.constraint  # None == 'none'
        self.seat_count = self.config.seat_count
        self.scoped = np.nonzero(self.pool.in_scope(self.config.scope, self.config.league))[0]

        self.taken = np.zeros(self.pool.size, dtype=bool)
        self.squads = [Squad() for _ in range(self.seat_count)]
        self.spend = TableSpend(self.pool)
        self.finalized = [False] * self.seat_count
        self.overall = 0
        self.total_picks = 11 * self.seat_count
        self.stalled_dead_ends = 0
        self._pending = {}

        self._cached_seat = None
        self._cached_mask = None
        self._advance()
        rewards, self._pending = self._pending, {}
        return rewards  # almost always {} -- only non-empty if a seat is dead-on-arrival

    def _advance(self) -> None:
        """Find the next seat actually due to act, auto-finalizing any seat whose
        current turn has zero legal candidates (see module docstring)."""
        while self.overall < self.total_picks:
            seat = seat_at(self.overall, self.seat_count)
            if self.finalized[seat]:
                self.overall += 1
                continue
            mask = self._eligibility(seat)
            if not mask.any():
                self.stalled_dead_ends += 1
                self._finalize(seat)
                self.overall += 1
                continue
            full_mask = np.zeros(self.pool.size, dtype=bool)
            full_mask[self.scoped] = mask
            self._cached_seat = seat
            self._cached_mask = full_mask
            return
        self._cached_seat = None
        self._cached_mask = None

    def _eligibility(self, seat: int) -> np.ndarray:
        return eligibility_mask(
            self.pool, self.scoped, self.taken, self.squads[seat].filled_slots(), self.constraint, self.spend
        )

    def _finalize(self, seat: int) -> float:
        reward = self.squads[seat].score(self.pool)
        self.finalized[seat] = True
        self._pending[seat] = reward
        return reward

    def acting_seat(self):
        return self._cached_seat

    def legal_action_mask(self) -> np.ndarray:
        """Full pool-sized bool mask (True only among self.scoped candidates)."""
        return self._cached_mask

    def observe(self, seat: int) -> dict:
        """candidate_indices is legal-only (matches env_spin_wheel/env_auction's swap
        phase): the RL layer never needs a separate mask to interpret the candidate
        list, only legal_action_mask() to validate/decode the chosen global index."""
        context = encode_context(
            self.pool, seat, self.squads, self.seat_count, self.overall, self.total_picks, self.constraint
        )
        candidate_indices = np.nonzero(self._cached_mask)[0]
        candidate_features = encode_candidates(self.pool, candidate_indices, self.constraint, self.spend)
        return {
            "context": context,
            "candidate_indices": candidate_indices,
            "candidate_features": candidate_features,
        }

    def step(self, action: int) -> dict:
        """Apply `action` (a global player index, must be legal for acting_seat()).
        Returns {seat: terminal_reward} for every seat that just finished — the
        acting seat if this was its 11th pick, PLUS any seat(s) _advance() auto-
        finalized while skipping past a stalled dead-end on the way to the next
        real turn. Both sources drain through the same `_pending` dict so neither
        is ever silently dropped."""
        seat = self._cached_seat
        assert seat is not None, "step() called after episode end"
        assert self._cached_mask[action], "illegal action"

        position = POSITION_CODES[self.pool.position_idx[action]]
        slot = self.squads[seat].assign(position, action)
        assert slot is not None
        self.taken[action] = True
        self.spend.record(self.pool, action)
        self.overall += 1

        if self.squads[seat].is_full():
            self._finalize(seat)

        self._advance()
        rewards, self._pending = self._pending, {}
        return rewards

    def done(self) -> bool:
        return self._cached_seat is None
