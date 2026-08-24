"""Per-seat squad bookkeeping shared by all four env implementations."""

from dataclasses import dataclass, field

from .formation import SLOT_POSITION, slot_for
from .scoring import POSITION_COEFFICIENTS


@dataclass
class Squad:
    slot_occupant: dict = field(default_factory=dict)  # slot_id -> global player index
    graveyard: list = field(default_factory=list)  # global player indices — Auction only

    def filled_slots(self) -> set:
        return set(self.slot_occupant.keys())

    def is_full(self) -> bool:
        return len(self.slot_occupant) == 11

    def assign(self, position: str, player_idx: int):
        """Place player_idx at position's first open slot. Returns the slot_id, or
        None if that position's slot(s) are already full (caller's problem to avoid —
        every env checks this before calling, since it mirrors an illegal action)."""
        slot = slot_for(position, self.filled_slots())
        if slot is not None:
            self.slot_occupant[slot] = player_idx
        return slot

    def score(self, pool) -> float:
        return sum(
            float(pool.ability[player_idx]) * POSITION_COEFFICIENTS[SLOT_POSITION[slot_id]]
            for slot_id, player_idx in self.slot_occupant.items()
        )
