import { describe, expect, it } from 'vitest'
import { SQUAD_SIZE, formation, positionCodes } from '../data/formation'
import { leagues } from '../data/lobbyOptions'
import { type Squad, seatAt, slotFor } from './draftEngine'
import type { Player } from './players'
import { landingRotation, sliceGradient, wheelSlices } from './wheelEngine'

/** Four clubs per league, every position twice over — enough to draft against. */
function buildPool(): Player[] {
  const players: Player[] = []
  for (const league of leagues) {
    for (let club = 0; club < 4; club += 1) {
      for (const position of positionCodes) {
        for (let copy = 0; copy < 2; copy += 1) {
          const id = `${league.id}-${club}-${position}-${copy}`
          players.push({
            id,
            name: id,
            surname: position,
            nation: 'Nowhere',
            age: 25,
            club: `${league.name} ${club}`,
            clubSlug: `${league.id}-${club}`,
            league: league.id as Player['league'],
            position,
            ability: 100 + copy,
            price: 10 + copy,
            crest: '',
            portraitBase: '',
          })
        }
      }
    }
  }
  return players
}

describe('the wheel', () => {
  it('puts a slice under the pointer', () => {
    // Six slices, so each is 60deg wide and slice 2 is centred on -150deg.
    const landed = landingRotation(0, 2, 6, () => 0.5)
    expect(landed).toBeGreaterThanOrEqual(360 * 4)
    expect(((landed % 360) + 360) % 360).toBeCloseTo(210, 6)
  })

  it('cuts the face into equal wedges with a hairline between them', () => {
    const gradient = sliceGradient(['red', 'blue', 'green', 'gold'])
    expect(gradient.startsWith('conic-gradient(from 0deg,')).toBe(true)
    expect(gradient).toContain('var(--color-ground) 0deg')
    expect(gradient).toContain('var(--color-ground) 270deg')
    expect(gradient).toContain('360deg')
  })

  it('only offers a category that still holds somebody legal', () => {
    const pool = buildPool()
    const squad: Squad = {}
    // Fill every keeper slot from one league, and take everyone else in it.
    const taken = new Set(
      pool.filter((player) => player.league === 'serie-a').map((player) => player.id),
    )

    const keys = wheelSlices(pool, squad, taken, 'league').map((slice) => slice.key)
    expect(keys).not.toContain('serie-a')
    expect(keys).toHaveLength(leagues.length - 1)
  })

  it('restricts club category to the top 15 clubs and randomizes wheel placement', () => {
    const clubs = [
      { name: 'Real Madrid', slug: 'real-madrid', league: 'la-liga' as const },
      { name: 'Arsenal', slug: 'arsenal', league: 'premier-league' as const },
      { name: 'Barcelona', slug: 'barcelona', league: 'la-liga' as const },
      { name: 'Juventus', slug: 'juventus', league: 'serie-a' as const },
      { name: 'Tottenham', slug: 'tottenham', league: 'premier-league' as const },
      { name: 'Chelsea', slug: 'chelsea', league: 'premier-league' as const },
      { name: 'Liverpool', slug: 'liverpool', league: 'premier-league' as const },
      { name: 'Atletico Madrid', slug: 'atletico-madrid', league: 'la-liga' as const },
      { name: 'Bayern Munich', slug: 'bayern-munich', league: 'bundesliga' as const },
      { name: 'Manchester United', slug: 'manchester-united', league: 'premier-league' as const },
      { name: 'PSG', slug: 'psg', league: 'ligue-1' as const },
      { name: 'Aston Villa', slug: 'aston-villa', league: 'premier-league' as const },
      { name: 'Napoli', slug: 'napoli', league: 'serie-a' as const },
      { name: 'Manchester City', slug: 'manchester-city', league: 'premier-league' as const },
      { name: 'Inter', slug: 'inter', league: 'serie-a' as const },
      { name: 'Free Agent', slug: 'free-agent', league: null },
      { name: 'Sassuolo', slug: 'sassuolo', league: 'serie-a' as const },
    ]

    const pool: Player[] = clubs.map((c) => ({
      id: c.slug,
      name: c.name,
      surname: c.name,
      nation: 'Nowhere',
      age: 25,
      club: c.name,
      clubSlug: c.slug,
      league: c.league,
      position: 'ST',
      ability: 85,
      price: 50,
      crest: '',
      portraitBase: '',
    }))

    const squad: Squad = {}
    const taken = new Set<string>()
    const slices = wheelSlices(pool, squad, taken, 'club')

    // Only the top 15 clubs should be included (excluding free-agent and sassuolo, including inter)
    expect(slices).toHaveLength(15)
    expect(slices.map((s) => s.key)).toContain('inter')
    expect(slices.map((s) => s.key)).not.toContain('free-agent')
    expect(slices.map((s) => s.key)).not.toContain('sassuolo')

    // Wheel placement is randomized (not sorted by league or alphabetically)
    const leagueOrder = slices.map((s) => s.league)
    // Confirm it is not grouped into contiguous blocks of leagues
    expect(leagueOrder).not.toEqual([...leagueOrder].sort())
  })
})

/**
 * The one way this format can break that Free Pick cannot: the wheel narrows
 * the board twice over, so a turn could in principle open on a category with
 * nobody legal in it and simply stop. Playing a whole draft out is the cheapest
 * proof that it does not.
 */
describe('a whole draft', () => {
  it('fills every eleven without the wheel running dry', () => {
    const pool = buildPool()
    const seats = 4
    const squads: Squad[] = Array.from({ length: seats }, () => ({}))
    const taken = new Set<string>()

    let seed = 7
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed / 2147483648
    }

    for (let overall = 0; overall < seats * SQUAD_SIZE; overall += 1) {
      const seat = seatAt(overall, seats)
      const squad = squads[seat]

      const slices = wheelSlices(pool, squad, taken, 'league')
      expect(slices.length).toBeGreaterThan(0)

      const slice = slices[Math.floor(random() * slices.length)]
      const board = pool.filter(
        (player) => player.league === slice.key && !taken.has(player.id) && slotFor(player, squad),
      )
      expect(board.length).toBeGreaterThan(0)

      // Any eligible name off the board proves the point here; the wheel's
      // exhaustion behaviour doesn't depend on which one gets taken.
      const player = board[Math.floor(random() * board.length)]

      const slot = slotFor(player, squad)
      expect(slot).not.toBeNull()
      squad[slot as NonNullable<typeof slot>] = player
      taken.add(player.id)
    }

    for (const squad of squads) {
      expect(formation.every((slot) => squad[slot.id])).toBe(true)
    }
  })
})
