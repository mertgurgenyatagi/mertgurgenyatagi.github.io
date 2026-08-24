import { describe, expect, it } from 'vitest'
import { type PositionCode, formation } from '../data/formation'
import { LOTS_PER_DRAFTER, buildLotList, openingBid, startingBudget } from './auctionEngine'
import type { Player } from './players'

function make(id: number, position: PositionCode, ability: number, price: number): Player {
  return {
    id: `p${id}`,
    name: `Player ${id}`,
    surname: `${id}`,
    nation: 'Nowhere',
    age: 27,
    club: 'Club',
    clubSlug: 'club',
    league: 'premier-league',
    position,
    ability,
    price,
    crest: '',
    portraitBase: '',
  }
}

/** Deep enough at every slot that a five-drafter table can be covered twice. */
function pool(): Player[] {
  const positions: PositionCode[] = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'AMF', 'LW', 'RW', 'ST']
  const players: Player[] = []
  let id = 0
  for (const position of positions) {
    for (let index = 0; index < 30; index += 1) {
      id += 1
      players.push(make(id, position, 60 + (index % 25), 10 + index * 4))
    }
  }
  return players
}

describe('auctionEngine', () => {
  it('opens at 70% of derived price, rounded to the nearest 5M', () => {
    expect(openingBid(make(1, 'ST', 90, 200))).toBe(140)
    expect(openingBid(make(2, 'ST', 60, 33))).toBe(25)
    // Never zero: something has to be biddable.
    expect(openingBid(make(3, 'GK', 40, 0))).toBe(5)
  })

  it('sets the budget from the pool average, rounded to the nearest 100M', () => {
    // 30 players per position, price 10 + i*4 → mean 68 → ×19 = 1292 → 1300.
    expect(startingBudget(pool())).toBe(1300)
    expect(startingBudget([])).toBe(0)
  })

  it('caps the lot list at 15 x lobby size and covers every slot', () => {
    for (const seats of [2, 5]) {
      const lots = buildLotList(pool(), seats)
      expect(lots).toHaveLength(LOTS_PER_DRAFTER * seats)

      // Position-by-position first: N per single-occupancy slot, 2N for CB, so
      // every table can fill its XI off the block without touching backfill.
      const counted = new Map<PositionCode, number>()
      for (const lot of lots) {
        counted.set(lot.player.position, (counted.get(lot.player.position) ?? 0) + 1)
      }
      for (const slot of formation) {
        const need = formation.filter((entry) => entry.position === slot.position).length * seats
        expect(counted.get(slot.position) ?? 0).toBeGreaterThanOrEqual(need)
      }

      // No footballer goes on the block twice, and the numbering is in order.
      expect(new Set(lots.map((lot) => lot.player.id)).size).toBe(lots.length)
      expect(lots.map((lot) => lot.number)).toEqual(lots.map((_, index) => index + 1))
    }
  })
})
