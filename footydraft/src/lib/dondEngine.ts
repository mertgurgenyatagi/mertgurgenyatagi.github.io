import { type FormationSlot, type PositionCode, formation } from '../data/formation'
import type { Player } from './players'

/**
 * Deal or No Deal's own rules, kept pure and away from React for the same
 * reason `draftEngine.ts` and `wheelEngine.ts` are: this is the file to read
 * when a rule is in question.
 *
 * Almost nothing about picking is shared with the other three formats. There
 * is no pool to choose from, no constraint, no snake — a round is a designated
 * position, `2N` sealed boxes drawn for it, and a turn is opening one of them
 * and deciding whether to keep what came out. `draftEngine.ts`'s `seatAt` is
 * explicitly wrong here: this format is a strict round robin with no reversal.
 */

export interface RoundPlan {
  /** Which of the eleven slots this round fills, for everybody at once. */
  slot: FormationSlot
  position: PositionCode
}

export interface Box {
  /** 1-based, and printed on the lid. The only thing a shut box says. */
  number: number
  player: Player
  /** Who opened it, or null while it is still shut. */
  openedBy: number | null
}

/* ------------------------------------------------------------------ order -- */

/**
 * The eleven rounds. Every round is one designated position, picked at random,
 * and there are exactly eleven slots in a 4-2-3-1 — so the draft's shape is a
 * shuffle of the formation rather than eleven independent draws. That is what
 * makes the format self-completing: every drafter fills every slot exactly
 * once, in the same order as everybody else.
 */
export function roundOrder(random: () => number = Math.random): RoundPlan[] {
  const slots = [...formation]
  for (let index = slots.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    ;[slots[index], slots[swap]] = [slots[swap], slots[index]]
  }
  return slots.map((slot) => ({ slot, position: slot.position }))
}

/**
 * Who opens when. A **strict round robin** — a fixed order that rotates by one
 * seat per round, and never reverses *(R5-Q7)*. Opening first is worth less
 * here than it is in a snake draft (every box in front of you is sealed) but it
 * is not worth nothing, so it still moves.
 */
export function seatOrder(round: number, seatCount: number): number[] {
  return Array.from({ length: seatCount }, (_, index) => (round - 1 + index) % seatCount)
}

/* ------------------------------------------------------------------ boxes -- */

/**
 * The pool's standing higher-ability skew, `p ∝ exp((ability − max) / 10)`.
 * Boxes are drawn against it exactly like everything else — they are not
 * pulled evenly just because they are boxes *(R6-Q2)*.
 */
export function skewedSample(
  candidates: Player[],
  count: number,
  random: () => number = Math.random,
): Player[] {
  const remaining = [...candidates]
  const drawn: Player[] = []

  while (drawn.length < count && remaining.length > 0) {
    let best = -Infinity
    for (const player of remaining) best = Math.max(best, player.ability)

    const weights = remaining.map((player) => Math.exp((player.ability - best) / 10))
    const total = weights.reduce((sum, weight) => sum + weight, 0)

    let ticket = random() * total
    let index = 0
    while (index < weights.length - 1 && ticket > weights[index]) {
      ticket -= weights[index]
      index += 1
    }

    drawn.push(remaining[index])
    remaining.splice(index, 1)
  }

  return drawn
}

/** `2N` boxes for an `N`-drafter table, all eligible for the round's position. */
export function drawBoxes(
  pool: Player[],
  position: PositionCode,
  seatCount: number,
  random: () => number = Math.random,
): Box[] {
  const eligible = pool.filter((player) => player.position === position)
  return skewedSample(eligible, seatCount * 2, random).map((player, index) => ({
    number: index + 1,
    player,
    openedBy: null,
  }))
}

/* ----------------------------------------------------------- the banker --- */

/**
 * What the banker is aiming at: fifteen points under the average ability of
 * whatever is still sealed *(R3-Q4, R8-Q5, R9-Q6)*. Sticking with the boxes is
 * meant to feel like the tempting side of the choice and the deal like a
 * concession, and this is the whole of that mechanism.
 *
 * It is flat and position-based only — the same number for everyone hearing an
 * offer this round, never adjusted per drafter for squad need or history
 * *(R6-Q8)*.
 */
export function bankerTarget(unopened: Box[]): number {
  if (unopened.length === 0) return 0
  const total = unopened.reduce((sum, box) => sum + box.player.ability, 0)
  return total / unopened.length - 15
}

/**
 * Who the banker actually names. Drawn from the undrafted pool for the round's
 * position, never from inside the boxes, and taken from whoever sits nearest
 * that flat target. One per drafter who asked to hear it: the calculation is
 * shared, the footballer cannot be.
 */
export function bankerOffers(
  pool: Player[],
  position: PositionCode,
  boxes: Box[],
  target: number,
  count: number,
): Player[] {
  const inBoxes = new Set(boxes.map((box) => box.player.id))
  return pool
    .filter((player) => player.position === position && !inBoxes.has(player.id))
    .sort((a, b) => Math.abs(a.ability - target) - Math.abs(b.ability - target))
    .slice(0, count)
}

/* -------------------------------------------------------------- the bots --- */

/**
 * Bot decision logic proper is deferred project-wide, so these are the two
 * honest heuristics that keep a table playing rather than a model.
 *
 * Both read `seen` — every box opened so far this round — and nothing else. A
 * bot cannot see inside a sealed box, so the opened ones are the only read it
 * has on how strong this round's field is, exactly as a person at the table
 * would have it.
 */
export function botSticks(box: Player, seen: Player[], random: () => number = Math.random): boolean {
  const field = mean(seen.map((player) => player.ability), box.ability)
  return box.ability >= field + (random() - 0.5) * 6
}

/** Taking the deal is the certain option; the boxes are the better average one. */
export function botTakesOffer(
  offer: Player,
  seen: Player[],
  random: () => number = Math.random,
): boolean {
  const field = mean(seen.map((player) => player.ability), offer.ability)
  return offer.ability >= field - 4 + (random() - 0.5) * 8
}

function mean(values: number[], fallback: number): number {
  if (values.length === 0) return fallback
  return values.reduce((sum, value) => sum + value, 0) / values.length
}
