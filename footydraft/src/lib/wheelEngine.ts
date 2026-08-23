import { leagues } from '../data/lobbyOptions'
import { type Squad, isEligible } from './draftEngine'
import type { Player } from './players'

/**
 * Spin the Wheel's own rules, kept pure and away from React for the same
 * reason `draftEngine.ts` is: this is the file to read when a rule is in
 * question.
 *
 * The pick itself is a free pick — same slot gate, same snake order, same
 * A–Z pool — so everything about *choosing* still comes out of
 * `draftEngine.ts`. What lives here is only the wheel: which category it is
 * drawn from, which slices it currently has, and where it stops.
 */

export type WheelCategory = 'league' | 'club' | 'nation'

export interface WheelSlice {
  /** The entity's own key: a league id, a club slug or a nation name. */
  key: string
  /** Set in Oswald in the hub when the wheel stops here. */
  label: string
  /** A crest, where one exists. Nations have no mark and get their letters. */
  mark: string | null
  /**
   * Which league this slice belongs to, where it belongs to one. On a league
   * wheel that is the slice itself; on a **club** wheel it is what keeps sixty
   * slices from reading as noise — a club is painted in its own league's
   * colour, so the wheel still has structure at a glance even when no single
   * wedge is wide enough to carry a crest.
   */
  league: string | null
}

const base = import.meta.env.BASE_URL

export function leagueMark(id: string): string {
  return `${base}leagues/${id}.svg`
}

/**
 * Which single category the whole draft's wheel is drawn from. It is decided
 * once, at the start, and never changes between spins *(R5-Q1)*.
 *
 * **The lobby now chooses between league and club** *(set by Mert,
 * 2026-08-23)*. Scope still fixes what it fixes: a single-league Scope has
 * already settled league, so that draft's wheel can only be clubs and the
 * setting collapses away. `All players` and `Top 5 leagues` leave both open
 * and the host picks — five wide wedges with a mark in each, or one wedge per
 * club, which is the same game played at a much finer grain.
 *
 * Anything unrecognised falls back to league, which is what an old lobby
 * config or a pasted link with no preference on it will hand over.
 */
export function categoryFor(scope: string, preference?: string): WheelCategory {
  if (scope === 'league') return 'club'
  return preference === 'club' ? 'club' : 'league'
}

/**
 * The pool holds footballers at clubs outside the top five, and those clubs
 * have no league on file — so under an `All players` scope the wheel gains one
 * more slice for everybody else. It is a real slice with real players behind
 * it, and it is the only one with no mark to draw.
 */
export const OTHER_LEAGUE = 'other'

export function entityKey(player: Player, category: WheelCategory): string {
  if (category === 'league') return player.league ?? OTHER_LEAGUE
  if (category === 'club') return player.clubSlug
  return player.nation
}

function entityLabel(player: Player, category: WheelCategory): string {
  if (category === 'league') {
    if (!player.league) return 'Elsewhere'
    return leagues.find((league) => league.id === player.league)?.name ?? player.league
  }
  if (category === 'club') return player.club
  return player.nation
}

function entityMark(player: Player, category: WheelCategory): string | null {
  if (category === 'league') return player.league ? leagueMark(player.league) : null
  if (category === 'club') return player.crest
  return null
}

/**
 * The top 15 clubs by player count in the database (excluding Free Agent,
 * including Inter). When the wheel is set to 'club', only these 15 clubs
 * appear on the wheel.
 */
export const TOP_WHEEL_CLUBS = [
  'real-madrid',
  'arsenal',
  'barcelona',
  'juventus',
  'tottenham',
  'chelsea',
  'liverpool',
  'atletico-madrid',
  'bayern-munich',
  'manchester-united',
  'psg',
  'aston-villa',
  'napoli',
  'manchester-city',
  'inter',
] as const

export const TOP_WHEEL_CLUBS_SET: ReadonlySet<string> = new Set(TOP_WHEEL_CLUBS)

/**
 * Deterministic 32-bit FNV-1a hash to randomize entity placement around the wheel
 * without clustering by league or alphabetical name, while staying stable across
 * re-renders and multiplayer clients.
 */
export function hashKey(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * One equal slice for every entity that currently holds at least one
 * footballer the drafter on the clock could legally take — so a league whose
 * remaining players all play in positions you have already filled is not on
 * the wheel at all, rather than being a slice that lands on nothing.
 *
 * Which means the wheel is rebuilt for whoever is picking, not once for the
 * table. Leagues keep the lobby's order so the wheel does not reshuffle its
 * colours between spins; clubs have their placement randomized across the wheel.
 */
export function wheelSlices(
  pool: Player[],
  squad: Squad,
  taken: ReadonlySet<string>,
  category: WheelCategory,
): WheelSlice[] {
  const found = new Map<string, WheelSlice>()

  for (const player of pool) {
    if (category === 'club' && !TOP_WHEEL_CLUBS_SET.has(player.clubSlug)) continue
    if (!isEligible(player, squad, 'none', taken)) continue
    const key = entityKey(player, category)
    if (found.has(key)) continue
    found.set(key, {
      key,
      label: entityLabel(player, category),
      mark: entityMark(player, category),
      league: player.league,
    })
  }

  const slices = [...found.values()]

  const order = leagues.map((league) => league.id)
  // `indexOf` returns -1 for anything outside the five, which would put it
  // first — it belongs last, after the ones that have a mark.
  const at = (key: string | null) =>
    !key || order.indexOf(key) < 0 ? order.length : order.indexOf(key)

  if (category === 'league') {
    return slices.sort((a, b) => at(a.key) - at(b.key))
  }

  /* Club wheel placement is randomized around the wheel rather than grouped by league. */
  if (category === 'club') {
    return slices.sort((a, b) => hashKey(a.key) - hashKey(b.key))
  }

  return slices.sort((a, b) => a.label.localeCompare(b.label))
}

/**
 * Where the wheel stops so that slice `index` sits under the pointer at the
 * top. Always at least **eight** whole turns further round than it is now — a
 * wheel that takes the short way to the next result reads as a dial being set
 * rather than as a wheel being spun, and the same is true of one that only
 * goes round a few times before easing to a halt.
 *
 * **The landing point inside the slice is uniformly random**, right out to
 * the edges. An earlier version held it to the middle 56% of the slice, which
 * meant the pointer never came to rest anywhere near a boundary — and a wheel
 * that always stops comfortably inside a wedge is a wheel that is visibly
 * choosing rather than landing. `0.98` leaves a hairline of clearance at each
 * edge so the result is never ambiguous about which slice it is in; every
 * position between those two hairlines is equally likely.
 */
const SLICE_SPREAD = 0.98

export function landingRotation(
  current: number,
  index: number,
  count: number,
  random: () => number = Math.random,
): number {
  if (count <= 0 || index < 0) return current + 360 * 8
  const step = 360 / count
  const target = -((index + 0.5) * step) + (random() - 0.5) * step * SLICE_SPREAD
  const next = current + 360 * 8
  return next + (((target - next) % 360) + 360) % 360
}

/**
 * The wheel's face. A hard-stopped conic gradient rather than eleven rotated
 * elements: one paint, no seams, and it survives any slice count the pool
 * hands it. Each boundary carries a hairline of the ground colour so the
 * slices read as cut rather than as a blend.
 */
export function sliceGradient(colours: string[]): string {
  const count = colours.length
  if (count === 0) return `conic-gradient(var(--color-surface) 0deg 360deg)`

  const step = 360 / count
  const cut = Math.min(1.4, step * 0.06)
  const stops: string[] = []

  colours.forEach((colour, index) => {
    const from = index * step
    stops.push(`var(--color-ground) ${from}deg ${from + cut}deg`)
    stops.push(`${colour} ${from + cut}deg ${from + step}deg`)
  })

  return `conic-gradient(from 0deg, ${stops.join(', ')})`
}

/**
 * The one place in the app that paints outside the four primes without a
 * licensed crest in its hand — see the note on `--color-league-*` in
 * index.css. Anything that is not one of the five leagues falls back to a
 * ramp mixed from the primes.
 */
const NEUTRAL_RAMP = [
  'var(--color-surface-2)',
  'var(--color-shade)',
  'var(--color-surface)',
  'var(--color-accent-ink)',
]

export function sliceColours(slices: WheelSlice[], category: WheelCategory): string[] {
  if (category === 'league') {
    // The fallback is what the everybody-else slice paints in: there is no
    // `--color-league-other`, and there should not be — it is not a league.
    return slices.map((slice) => `var(--color-league-${slice.key}, var(--color-surface-2))`)
  }

  /**
   * A club wheel is coloured by the club's *league*, with neighbouring clubs
   * in the same league alternating between the league's colour and a slightly
   * darker mix of it. That keeps the five bands readable at sixty slices while
   * still drawing a boundary between one club and the next, which a flat band
   * would not. A club outside the top five has no league colour to take and
   * falls back to the neutral ramp.
   */
  if (category === 'club') {
    let run = 0
    let previous: string | null = null
    return slices.map((slice, index) => {
      if (slice.league !== previous) {
        previous = slice.league
        run = 0
      } else {
        run += 1
      }
      if (!slice.league) return NEUTRAL_RAMP[index % NEUTRAL_RAMP.length]
      const base = `var(--color-league-${slice.league}, var(--color-surface-2))`
      return run % 2 === 0
        ? base
        : `color-mix(in oklab, ${base} 62%, var(--color-ground))`
    })
  }

  return slices.map((_, index) => NEUTRAL_RAMP[index % NEUTRAL_RAMP.length])
}
