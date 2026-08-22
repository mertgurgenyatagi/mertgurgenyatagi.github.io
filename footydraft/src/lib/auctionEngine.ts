import { type PositionCode, formation } from '../data/formation'
import { type Squad, slotFor } from './draftEngine'
import type { Player } from './players'

/**
 * The Auction, as rules rather than as a screen. Pure — nothing here touches
 * React, which is what makes it the thing to read when a rule is in question.
 *
 * The one structural difference from the other three formats: there is no turn.
 * Bidding is real time, every seat can raise at any moment, and what the clock
 * measures is inactivity rather than anybody's window. Everything below is
 * written for that — a lot has a *holder*, not an active seat.
 */

/** At most `15 × N` footballers go on the block for an `N`-drafter table. */
export const LOTS_PER_DRAFTER = 15

/** Flat, stepped, and live at every price point — they don't scale with price. */
export const BID_STEPS = [5, 10, 25] as const

/** The pool's high-ability skew: `p ∝ exp((ability − max) / 10)`. */
const SKEW_TEMPERATURE = 10

/**
 * Held back per still-empty slot when a seat decides what it can spend. Not a
 * rule — the rules explicitly refuse to reserve funds during bidding — only
 * what a bot chooses to leave itself, which is a decision it is free to make
 * and a human is free not to.
 */
const RESERVE_PER_SLOT = 6

export interface Lot {
  /** 1-based position in the lot list. The number the screen prints. */
  number: number
  player: Player
  /** 70% of derived market value, rounded to the nearest 5M. */
  opening: number
}

export interface Sale {
  lot: number
  player: Player
  /** The buyer, or null when the lot drew no bid and went to the unsold pile. */
  seat: number | null
  price: number
}

/* ------------------------------------------------------------------ money -- */

export function openingBid(player: Player): number {
  return Math.max(5, Math.round((player.price * 0.7) / 5) * 5)
}

/**
 * `(average derived price of the scoped pool) × 19`, rounded to the nearest
 * 100M *(R8-Q0, amended 2026-08-19)*. Top 5 leagues comes out at 800M.
 */
export function startingBudget(pool: Player[]): number {
  if (pool.length === 0) return 0
  const average = pool.reduce((sum, player) => sum + player.price, 0) / pool.length
  return Math.max(100, Math.round((average * 19) / 100) * 100)
}

/* ------------------------------------------------------------- the lot list -- */

/**
 * Draw `count` footballers without replacement, weighted toward the top end.
 * The exponential is taken against the best ability present, so the curve is
 * the same shape whatever slice of the pool it is handed.
 */
function drawSkewed(from: Player[], count: number, random: () => number): Player[] {
  const remaining = [...from]
  const drawn: Player[] = []
  if (remaining.length === 0) return drawn

  const best = remaining.reduce((max, player) => Math.max(max, player.ability), 0)

  while (drawn.length < count && remaining.length > 0) {
    const weights = remaining.map((player) =>
      Math.exp((player.ability - best) / SKEW_TEMPERATURE),
    )
    const total = weights.reduce((sum, weight) => sum + weight, 0)

    let roll = random() * total
    let index = 0
    while (index < weights.length - 1 && roll > weights[index]) {
      roll -= weights[index]
      index += 1
    }

    drawn.push(remaining[index])
    remaining.splice(index, 1)
  }

  return drawn
}

/**
 * The lot list — at most `15 × N`, never the whole scope.
 *
 * Built position-by-position first: `N` for every single-occupancy slot and
 * `2N` for centre back, which is `11N`, so every table can fill its XI off the
 * block. The remaining `4N` come from the rest of the pool under the same
 * skew, and are the contested surplus. A flat random draw of `15N` would leave
 * the thin positions short about half the time, which is the whole reason this
 * is not one call to `drawSkewed`.
 *
 * The order is then shuffled: the reveal order is fully random, with no quality
 * curve and no position cycling *(R6-Q1)*.
 */
export function buildLotList(
  pool: Player[],
  seatCount: number,
  random: () => number = Math.random,
): Lot[] {
  const target = LOTS_PER_DRAFTER * seatCount

  const need = new Map<PositionCode, number>()
  for (const slot of formation) {
    need.set(slot.position, (need.get(slot.position) ?? 0) + seatCount)
  }

  const chosen: Player[] = []
  const claimed = new Set<string>()

  for (const [position, count] of need) {
    const candidates = pool.filter((player) => player.position === position)
    for (const player of drawSkewed(candidates, count, random)) {
      chosen.push(player)
      claimed.add(player.id)
    }
  }

  const rest = pool.filter((player) => !claimed.has(player.id))
  for (const player of drawSkewed(rest, Math.max(0, target - chosen.length), random)) {
    chosen.push(player)
  }

  for (let index = chosen.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    const held = chosen[index]
    chosen[index] = chosen[swap]
    chosen[swap] = held
  }

  return chosen.map((player, index) => ({
    number: index + 1,
    player,
    opening: openingBid(player),
  }))
}

/* ---------------------------------------------------------------- squads --- */

export function openSlots(squad: Squad): number {
  return formation.filter((slot) => !squad[slot.id]).length
}

/**
 * Where a purchase lands. An open slot for that position takes it directly;
 * only when every slot for the position is already full does it overflow into
 * the buyer's spares *(R7.2-Q1)*.
 */
export function landingSlot(player: Player, squad: Squad) {
  return slotFor(player, squad)
}

/** The cheapest footballer left who could fill this position. Backfill's pick. */
export function cheapestFor(
  position: PositionCode,
  pool: Player[],
  taken: ReadonlySet<string>,
): Player | null {
  let cheapest: Player | null = null
  for (const player of pool) {
    if (player.position !== position || taken.has(player.id)) continue
    if (!cheapest || player.price < cheapest.price) cheapest = player
  }
  return cheapest
}

/* --------------------------------------------------------- what a seat pays -- */

/**
 * The most a seat will commit right now, leaving itself something for the slots
 * it still has to fill. Bidding is never gated by slot status — a seat with a
 * full XI can keep raising to block, or to stockpile a spare *(R5-Q6)* — so
 * this only ever returns a smaller number, never a refusal.
 */
export function spendable(budget: number, squad: Squad): number {
  return budget - Math.max(0, openSlots(squad) - 1) * RESERVE_PER_SLOT
}

/**
 * What this footballer is worth to this seat, in EURm.
 *
 * `taste` is a per-seat, per-lot number in 0–1 that stops a table of bots from
 * agreeing on every valuation and turning every lot into the same auction.
 * Ability is read here and rendered nowhere, same as everywhere else.
 */
export function ceilingFor(player: Player, squad: Squad, budget: number, taste: number): number {
  const fits = landingSlot(player, squad) !== null
  const left = openSlots(squad)

  // A slot that is already full is worth blocking money only — a spare is a
  // real asset, but never the one you were budgeting for.
  const appetite = fits ? (left <= 3 ? 1.3 : 1.04) : 0.32
  const base = player.price * (0.8 + taste * 0.52)

  return Math.min(Math.floor(base * appetite), Math.max(0, spendable(budget, squad)))
}

/**
 * The raise a seat makes, or null when it is done with this lot. Mostly the
 * smallest step that clears — a bidder with a lot of room left occasionally
 * jumps, which is what ends a lot in four raises instead of twenty.
 */
export function stepFor(price: number, ceiling: number, random: () => number): number | null {
  const affordable = BID_STEPS.filter((step) => price + step <= ceiling)
  if (affordable.length === 0) return null

  const room = ceiling - price
  const roll = random()
  if (room >= 60 && roll > 0.74 && affordable.includes(25)) return 25
  if (room >= 25 && roll > 0.58 && affordable.includes(10)) return 10
  return affordable[0]
}

/**
 * The hard, global stop *(R3-Q10)*. The auction is over the moment nobody can
 * afford anything still to come — it does not wait for seats to trail off one
 * at a time — or when the lot list runs out, whichever lands first.
 */
export function auctionExhausted(
  remaining: Lot[],
  budgets: number[],
  squads: Squad[],
): boolean {
  if (remaining.length === 0) return true
  return !remaining.some((lot) =>
    budgets.some((budget, seat) => budget >= lot.opening && openSlots(squads[seat] ?? {}) > 0),
  )
}
