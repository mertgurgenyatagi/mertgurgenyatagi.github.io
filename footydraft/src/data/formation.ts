/**
 * 4-2-3-1. The only shape in the game, and the reason the position reform gave
 * every footballer exactly one slot: eleven slots, ten position codes, two
 * centre-backs and no ambiguity about where anybody goes.
 *
 * `x` / `y` are percentages of the pitch box, attacking upward — the keeper
 * sits at the bottom, the striker at the top, which is how a drafter reads
 * their own team sheet. The list order is also the order the eleven is spoken
 * about anywhere else on the screen.
 */

export type PositionCode =
  | 'GK'
  | 'CB'
  | 'LB'
  | 'RB'
  | 'CDM'
  | 'CM'
  | 'AMF'
  | 'LW'
  | 'RW'
  | 'ST'

export type SlotId =
  | 'gk'
  | 'lb'
  | 'cb-l'
  | 'cb-r'
  | 'rb'
  | 'cdm'
  | 'cm'
  | 'lw'
  | 'amf'
  | 'rw'
  | 'st'

export interface FormationSlot {
  id: SlotId
  position: PositionCode
  x: number
  y: number
}

export const formation: FormationSlot[] = [
  { id: 'gk', position: 'GK', x: 50, y: 89 },
  { id: 'lb', position: 'LB', x: 11, y: 71 },
  { id: 'cb-l', position: 'CB', x: 36, y: 80 },
  { id: 'cb-r', position: 'CB', x: 64, y: 80 },
  { id: 'rb', position: 'RB', x: 89, y: 71 },
  { id: 'cdm', position: 'CDM', x: 33, y: 57 },
  { id: 'cm', position: 'CM', x: 67, y: 57 },
  { id: 'lw', position: 'LW', x: 12, y: 34 },
  { id: 'amf', position: 'AMF', x: 50, y: 39 },
  { id: 'rw', position: 'RW', x: 88, y: 34 },
  { id: 'st', position: 'ST', x: 50, y: 17 },
]

/** Every position code, in the order the filter row draws them. */
export const positionCodes: PositionCode[] = [
  'GK',
  'LB',
  'CB',
  'RB',
  'CDM',
  'CM',
  'AMF',
  'LW',
  'RW',
  'ST',
]

/** The full name behind each code, for anywhere a code alone is too terse to read. */
export const positionNames: Record<PositionCode, string> = {
  GK: 'Goalkeeper',
  LB: 'Left Back',
  CB: 'Centre Back',
  RB: 'Right Back',
  CDM: 'Defensive Midfielder',
  CM: 'Central Midfielder',
  AMF: 'Attacking Midfielder',
  LW: 'Left Winger',
  RW: 'Right Winger',
  ST: 'Striker',
}

export const SQUAD_SIZE = formation.length
