import { describe, expect, it } from 'vitest'
import { SQUAD_SIZE, formation, positionCodes } from '../data/formation'
import { leagues } from '../data/lobbyOptions'
import { type Squad, botChoice, seatAt, slotFor } from './draftEngine'
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
    expect(gradient).toContain('red 1.4deg 90deg')
    expect(gradient).toContain('gold 271.4deg 360deg')
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

      const round = Math.floor(overall / seats) + 1
      const player = botChoice(board, squad, 'none', taken, SQUAD_SIZE - round + 1, random)
      expect(player).not.toBeNull()

      const slot = slotFor(player as Player, squad)
      expect(slot).not.toBeNull()
      squad[slot as NonNullable<typeof slot>] = player as Player
      taken.add((player as Player).id)
    }

    for (const squad of squads) {
      expect(formation.every((slot) => squad[slot.id])).toBe(true)
    }
  })
})
