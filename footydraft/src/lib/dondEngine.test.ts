import { describe, expect, it } from 'vitest'
import { SQUAD_SIZE, positionCodes } from '../data/formation'
import {
  type Box,
  bankerOffers,
  bankerTarget,
  drawBoxes,
  roundOrder,
  seatOrder,
} from './dondEngine'
import type { Player } from './players'

/** Eight of every position, with a spread of abilities to price against. */
function buildPool(): Player[] {
  const players: Player[] = []
  for (const position of positionCodes) {
    for (let copy = 0; copy < 8; copy += 1) {
      const id = `${position}-${copy}`
      players.push({
        id,
        name: id,
        surname: position,
        nation: 'Nowhere',
        age: 25,
        club: `Club ${copy}`,
        clubSlug: `club-${copy}`,
        league: 'premier-league',
        position,
        ability: 120 + copy * 5,
        price: 10 + copy,
        crest: '',
        portraitBase: '',
      })
    }
  }
  return players
}

describe('the rounds', () => {
  it('is a shuffle of the eleven slots, so every squad fills exactly once', () => {
    const rounds = roundOrder(() => 0.5)
    expect(rounds).toHaveLength(SQUAD_SIZE)
    expect(new Set(rounds.map((round) => round.slot.id)).size).toBe(SQUAD_SIZE)
  })

  it('is a round robin that rotates and never reverses', () => {
    expect(seatOrder(1, 4)).toEqual([0, 1, 2, 3])
    expect(seatOrder(2, 4)).toEqual([1, 2, 3, 0])
    expect(seatOrder(3, 4)).toEqual([2, 3, 0, 1])
    // The tell against a snake: round 2 does not open with the seat that
    // closed round 1.
    expect(seatOrder(2, 4)[0]).not.toBe(3)
  })
})

describe('the boxes', () => {
  it('deals two per drafter, all eligible for the round position', () => {
    const boxes = drawBoxes(buildPool(), 'CDM', 4)
    expect(boxes).toHaveLength(8)
    expect(boxes.every((box) => box.player.position === 'CDM')).toBe(true)
    expect(new Set(boxes.map((box) => box.player.id)).size).toBe(8)
    expect(boxes.map((box) => box.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })
})

describe('the banker', () => {
  const boxed = (abilities: number[]): Box[] =>
    abilities.map((ability, index) => ({
      number: index + 1,
      player: { ...buildPool()[0], id: `box-${index}`, ability },
      openedBy: null,
    }))

  it('prices fifteen under the average of what is still sealed', () => {
    expect(bankerTarget(boxed([100, 120, 140]))).toBeCloseTo(105, 6)
  })

  it('names somebody from the pool, never from inside a box, one each', () => {
    const pool = buildPool()
    const boxes = drawBoxes(pool, 'CDM', 2)
    const inBoxes = new Set(boxes.map((box) => box.player.id))

    const offers = bankerOffers(pool, 'CDM', boxes, bankerTarget(boxes), 2)
    expect(offers).toHaveLength(2)
    expect(offers.every((player) => player.position === 'CDM')).toBe(true)
    expect(offers.some((player) => inBoxes.has(player.id))).toBe(false)
    expect(offers[0].id).not.toBe(offers[1].id)
  })
})
