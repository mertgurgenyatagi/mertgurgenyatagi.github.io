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

/**
 * How long a lot may sit without a bid before the hammer falls.
 *
 * Not a setting any more — see the note where `timers` used to be in
 * `lobbyOptions`. The clock is this format's own closing mechanism rather than
 * a courtesy to a slow drafter: with no turns, it is the only thing that ends
 * a lot, so there was never a coherent "off" for it to have.
 */
export const AUCTION_BID_SECONDS = 15

/** Flat, stepped, and live at every price point — they don't scale with price. */
export const BID_STEPS = [5, 10, 25] as const

/** The pool's high-ability skew: `p ∝ exp((ability − max) / 10)`. */
const SKEW_TEMPERATURE = 10

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

/**
 * Backfill's pick: the **lowest-rated** footballer left who could fill this
 * position, drawn from the whole scoped pool.
 *
 * *(Set by Mert, 2026-08-23.)* It used to take the cheapest, which is nearly
 * the same ordering — derived price is an exponential function of ability —
 * but not quite, and not the one that was asked for. The pool it reads is the
 * scoped pool minus everything already spoken for, **not the lot list**: the
 * `15 × N` cap and its high-ability skew decide who goes on the block, and
 * neither has any business deciding who fills a slot nobody bid for. Running
 * out of money gets you the worst player available, never fewer players.
 */
export function weakestFor(
  position: PositionCode,
  pool: Player[],
  taken: ReadonlySet<string>,
): Player | null {
  let weakest: Player | null = null
  for (const player of pool) {
    if (player.position !== position || taken.has(player.id)) continue
    if (!weakest || player.ability < weakest.ability) weakest = player
  }
  return weakest
}

/* ------------------------------------------------------------- passing ---- */

/**
 * **A lot closes the moment everybody but the holder has passed** *(set by
 * Mert, 2026-08-23)*.
 *
 * Passing is now a real move rather than a description of what a seat that
 * stopped bidding had done. The clock is still the auction's closing mechanism
 * in the ordinary case; this is the shortcut for the case where waiting it out
 * decides nothing, because there is nobody left who could raise. A seat that
 * has passed is out of *this lot* for good — it does not get to think again at
 * a higher price, which is the only thing that makes the shortcut safe.
 *
 * With nobody holding the lot, everybody standing down means it draws no bid
 * at all and goes to the unsold pile *(R8-Q4)* rather than sitting out its
 * countdown in front of a room that has already decided.
 */
export function lotIsDecided(
  holder: number | null,
  out: readonly number[],
  seatCount: number,
): boolean {
  const standing = seatCount - out.length
  if (holder === null) return standing <= 0
  return standing <= 1
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
