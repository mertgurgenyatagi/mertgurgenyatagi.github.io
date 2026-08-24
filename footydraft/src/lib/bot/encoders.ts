import { positionCodes as POSITION_CODES } from '../../data/formation'
import { MAX_SEATS } from '../../data/lobbyOptions'
import type { Player } from '../players'
import type { Squad, TableSpend } from '../draftEngine'
import { formation, type SlotId } from '../../data/formation'

// Compute SLOTS_FOR_POSITION locally since formation.ts doesn't export it
const SLOTS_FOR_POSITION: Record<string, SlotId[]> = {}
for (const pc of POSITION_CODES) {
  SLOTS_FOR_POSITION[pc] = formation.filter(s => s.position === pc).map(s => s.id)
}

const ABILITY_SCALE = 200.0
const PRICE_SCALE = 200.0
const MAX_OPPONENTS = MAX_SEATS - 1
const N_POSITIONS = POSITION_CODES.length
const SQUAD_SUMMARY_LEN = N_POSITIONS * 3
export const CONTEXT_LEN = SQUAD_SUMMARY_LEN + MAX_OPPONENTS * (SQUAD_SUMMARY_LEN + 1) + 4
export const CANDIDATE_FEATURE_LEN = 3 + N_POSITIONS + 1

function squadSummary(squad: Squad): number[] {
  const out: number[] = []
  for (const pos of POSITION_CODES) {
    const slots = SLOTS_FOR_POSITION[pos] || []
    const filledPlayers = slots.map(s => squad[s]).filter(Boolean) as Player[]
    const bestAbility = filledPlayers.length > 0 ? Math.max(...filledPlayers.map(p => p.ability)) : 0.0
    out.push(filledPlayers.length)
    out.push(slots.length - filledPlayers.length)
    out.push(bestAbility / ABILITY_SCALE)
  }
  return out
}

function capFor(constraint: string | null): { key: 'clubs' | 'nations', limit: number } | null {
  if (!constraint || constraint === 'none') return null
  if (constraint === 'club-1') return { key: 'clubs', limit: 1 }
  if (constraint === 'club-3') return { key: 'clubs', limit: 3 }
  if (constraint === 'nation-1') return { key: 'nations', limit: 1 }
  if (constraint === 'nation-3') return { key: 'nations', limit: 3 }
  return null
}

export function encodeContext(
  seat: number,
  squads: Squad[],
  seatCount: number,
  overall: number,
  totalPicks: number,
  constraint: string | null
): Float32Array {
  const features: number[] = []
  features.push(...squadSummary(squads[seat]))

  const turnOrderAfterMe = Array.from({ length: seatCount - 1 }, (_, k) => (seat + 1 + k) % seatCount)
  
  for (let k = 0; k < MAX_OPPONENTS; k++) {
    if (k < turnOrderAfterMe.length) {
      const opp = squads[turnOrderAfterMe[k]]
      features.push(...squadSummary(opp))
      features.push(1.0)
    } else {
      for (let i = 0; i < SQUAD_SUMMARY_LEN; i++) features.push(0.0)
      features.push(0.0)
    }
  }

  features.push(overall / Math.max(totalPicks, 1))
  features.push(seatCount / MAX_SEATS)
  const cap = capFor(constraint)
  features.push(cap ? 1.0 : 0.0)
  features.push(cap ? cap.limit / 3.0 : 0.0)

  return new Float32Array(features)
}

export function encodeCandidates(
  candidates: Player[],
  constraint: string | null,
  spend: TableSpend | null
): Float32Array {
  const n = candidates.length
  const out = new Float32Array(n * CANDIDATE_FEATURE_LEN)
  let offset = 0
  const cap = capFor(constraint)

  for (const p of candidates) {
    out[offset++] = p.ability / ABILITY_SCALE
    out[offset++] = p.price / PRICE_SCALE
    out[offset++] = p.league ? 1.0 : 0.0 

    const posIdx = POSITION_CODES.indexOf(p.position)
    for (let i = 0; i < N_POSITIONS; i++) {
      out[offset++] = (i === posIdx) ? 1.0 : 0.0
    }

    let scarcity = 0.0
    if (cap && spend) {
      const used = cap.key === 'clubs' ? (spend.clubs[p.clubSlug] || 0) : (spend.nations[p.nation] || 0)
      scarcity = used / cap.limit
    }
    out[offset++] = scarcity
  }
  return out
}

export const DOND_OBS_LEN = CONTEXT_LEN + 2 + N_POSITIONS + 5
export function encodeDondContext(
  seat: number,
  squads: Squad[],
  seatCount: number,
  picksMade: number,
  totalPicks: number,
  stage: 'opening' | 'offer',
  roundPosition: string,
  originalPlayer: Player,
  currentPlayer: Player,
  numSealed: number,
  roundNumber: number
): Float32Array {
  const ctx = encodeContext(seat, squads, seatCount, picksMade, totalPicks, null)
  const features = new Float32Array(DOND_OBS_LEN)
  features.set(ctx, 0)
  
  let offset = CONTEXT_LEN
  features[offset++] = stage === 'opening' ? 1.0 : 0.0
  features[offset++] = stage === 'offer' ? 1.0 : 0.0

  const posIdx = POSITION_CODES.indexOf(roundPosition as any)
  for (let i = 0; i < N_POSITIONS; i++) {
    features[offset++] = (i === posIdx) ? 1.0 : 0.0
  }

  features[offset++] = originalPlayer.ability / ABILITY_SCALE
  features[offset++] = currentPlayer.ability / ABILITY_SCALE
  features[offset++] = currentPlayer.price / PRICE_SCALE
  features[offset++] = numSealed / (2 * seatCount)
  features[offset++] = roundNumber / 11.0

  return features
}

export const BIDDING_OBS_LEN = CONTEXT_LEN + CANDIDATE_FEATURE_LEN + 13
const BUDGET_SCALE = 2000.0
export function encodeBiddingContext(
  seat: number,
  squads: Squad[],
  seatCount: number,
  cursor: number,
  totalLots: number,
  lotPlayer: Player,
  lotOpening: number,
  lotPrice: number,
  lotHolder: number | null,
  lotOutCount: number,
  lockoutActive: boolean,
  budgets: number[]
): Float32Array {
  const ctx = encodeContext(seat, squads, seatCount, cursor, totalLots, null)
  const lotFeatures = encodeCandidates([lotPlayer], null, null)

  const features = new Float32Array(BIDDING_OBS_LEN)
  features.set(ctx, 0)
  features.set(lotFeatures, CONTEXT_LEN)

  let offset = CONTEXT_LEN + CANDIDATE_FEATURE_LEN
  features[offset++] = lotPrice / BUDGET_SCALE
  features[offset++] = lotOpening / BUDGET_SCALE
  features[offset++] = lotHolder === seat ? 1.0 : 0.0
  features[offset++] = lotHolder === null ? 1.0 : 0.0
  features[offset++] = (seatCount - lotOutCount) / seatCount
  features[offset++] = lockoutActive ? 1.0 : 0.0
  features[offset++] = budgets[seat] / BUDGET_SCALE

  const order = Array.from({ length: seatCount - 1 }, (_, k) => (seat + 1 + k) % seatCount)
  for (let k = 0; k < MAX_OPPONENTS; k++) {
    features[offset++] = k < order.length ? budgets[order[k]] / BUDGET_SCALE : 0.0
  }

  return features
}
