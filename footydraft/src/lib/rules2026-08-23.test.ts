import { describe, expect, it } from 'vitest'
import type { PositionCode } from '../data/formation'
import { lotIsDecided, weakestFor } from './auctionEngine'
import { blockedReason, tableSpend, type Pick } from './draftEngine'
import { categoryFor } from './wheelEngine'
import type { Player } from './players'

/**
 * The four rules that changed on 2026-08-23. Each of these was a decision
 * rather than a refactor, so each gets the one test that would catch it being
 * quietly reverted.
 */

function make(
  id: string,
  position: PositionCode,
  ability: number,
  club = 'Club',
  nation = 'Nowhere',
): Player {
  return {
    id,
    name: id,
    surname: id,
    nation,
    age: 27,
    club,
    clubSlug: club.toLowerCase().replace(/\s+/g, '-'),
    league: 'premier-league',
    position,
    ability,
    price: ability,
    crest: '',
    portraitBase: '',
  }
}

function pickOf(seat: number, player: Player): Pick {
  return { overall: seat, seat, slot: 'gk', player }
}

describe('the auction pass rule', () => {
  it('closes a held lot once everybody else has stood down', () => {
    // Five seats, one holding: four passes leaves nobody who could raise.
    expect(lotIsDecided(0, [1, 2, 3], 5)).toBe(false)
    expect(lotIsDecided(0, [1, 2, 3, 4], 5)).toBe(true)
  })

  it('does not close a lot nobody holds until the room has finished with it', () => {
    // With no holder the clock is still the thing that ends it — right up
    // until every seat has passed, at which point it goes unsold.
    expect(lotIsDecided(null, [1, 2, 3, 4], 5)).toBe(false)
    expect(lotIsDecided(null, [0, 1, 2, 3, 4], 5)).toBe(true)
  })
})

describe('auction backfill', () => {
  it('takes the lowest-rated eligible footballer, not the cheapest-looking one', () => {
    const pool = [
      make('strong', 'GK', 90),
      make('weak', 'GK', 40),
      make('weakest-but-taken', 'GK', 10),
      make('wrong-position', 'ST', 5),
    ]
    const taken = new Set(['weakest-but-taken'])

    expect(weakestFor('GK', pool, taken)?.id).toBe('weak')
    expect(weakestFor('CB', pool, taken)).toBeNull()
  })
})

describe('constraints are shared across the table', () => {
  const salah = make('salah', 'RW', 90, 'Liverpool', 'Egypt')
  const alisson = make('alisson', 'GK', 88, 'Liverpool', 'Brazil')

  it('spends a club for everybody, not only for the drafter who took it', () => {
    // Seat 0 takes a Liverpool player; seat 1 is asking about another one.
    const spend = tableSpend([pickOf(0, salah)])
    const theirSquad = {}

    const blocked = blockedReason(alisson, theirSquad, 'club-1', new Set(['salah']), spend)
    expect(blocked).toEqual({ key: '{club} is gone.', vars: { club: 'Liverpool' } })
  })

  it('still allows the club until the cap is actually reached', () => {
    const spend = tableSpend([pickOf(0, salah)])
    expect(blockedReason(alisson, {}, 'club-3', new Set(['salah']), spend)).toBeNull()
  })

  it('leaves an unconstrained draft alone', () => {
    const spend = tableSpend([pickOf(0, salah)])
    expect(blockedReason(alisson, {}, 'none', new Set(['salah']), spend)).toBeNull()
  })
})

describe('the wheel category', () => {
  it('takes the lobby preference while scope leaves both axes open', () => {
    expect(categoryFor('all')).toBe('league')
    expect(categoryFor('all', 'club')).toBe('club')
    expect(categoryFor('top-5', 'club')).toBe('club')
    expect(categoryFor('top-5', 'league')).toBe('league')
  })

  it('is clubs by construction once scope has fixed the league', () => {
    expect(categoryFor('league', 'league')).toBe('club')
    expect(categoryFor('league')).toBe('club')
  })

  it('falls back to league for a config that carries no preference', () => {
    expect(categoryFor('all', undefined)).toBe('league')
    expect(categoryFor('all', 'nonsense')).toBe('league')
  })
})
