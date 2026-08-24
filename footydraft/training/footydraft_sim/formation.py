"""Ported verbatim from src/data/formation.ts. 4-2-3-1, the only shape in the game."""

# (slot_id, position_code) in exact array order from formation.ts — this order is
# load-bearing: slotFor()/backfill iterate slots in this order, so cb-l always
# fills before cb-r.
SLOTS = [
    ("gk", "GK"),
    ("lb", "LB"),
    ("cb-l", "CB"),
    ("cb-r", "CB"),
    ("rb", "RB"),
    ("cdm", "CDM"),
    ("cm", "CM"),
    ("lw", "LW"),
    ("amf", "AMF"),
    ("rw", "RW"),
    ("st", "ST"),
]

SLOT_IDS = [s[0] for s in SLOTS]
SLOT_POSITION = dict(SLOTS)  # slot_id -> position code
SQUAD_SIZE = len(SLOTS)  # 11

# The 10 distinct position codes, in the order the coefficients were supplied.
POSITION_CODES = ["GK", "CB", "LB", "RB", "CDM", "CM", "AMF", "LW", "RW", "ST"]

# Slot ids matching a given position, in formation order (CB -> ['cb-l', 'cb-r']).
SLOTS_FOR_POSITION = {pos: [sid for sid, p in SLOTS if p == pos] for pos in POSITION_CODES}


def slots_open(occupied_slot_ids, position):
    """Open (unfilled) slot ids for `position`, in formation order."""
    return [sid for sid in SLOTS_FOR_POSITION[position] if sid not in occupied_slot_ids]


def slot_for(position, occupied_slot_ids):
    """First open FormationSlot matching `position`, formation-array order, or None.

    Mirrors draftEngine.ts's slotFor: for CB this returns 'cb-l' before 'cb-r'.
    """
    open_slots = slots_open(occupied_slot_ids, position)
    return open_slots[0] if open_slots else None
