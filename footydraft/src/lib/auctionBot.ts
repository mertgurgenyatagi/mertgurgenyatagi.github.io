import { formation } from '../data/formation'
import type { Squad } from './draftEngine'
import type { Block } from '../routes/AuctionDraft'

import weights from '../data/botModels/auction_policy.json'

const NORM_ABILITY = 200.0
const NORM_PRICE = 1000.0
const NORM_ROUNDS = 10.0
const NORM_LOTS = 75.0
const NORM_POOL = 546.0

const POS_LIST = ['AMF', 'CB', 'CDM', 'CM', 'GK', 'LB', 'LW', 'RB', 'RW', 'ST'] as const
function positionToIndex(pos: string): number {
  return POS_LIST.indexOf(pos as any)
}

const POSITION_MULTIPLIERS: Record<string, number> = {
  ST: 1.0846,
  AMF: 1.0624,
  CM: 1.0612,
  RW: 1.0342,
  LW: 1.0322,
  CDM: 0.9827,
  RB: 0.9760,
  LB: 0.9750,
  CB: 0.9730,
  GK: 0.8358,
}

function linear(x: number[], w: number[][], b: number[]): number[] {
  const out = new Array(w.length).fill(0)
  for (let i = 0; i < w.length; i++) {
    let sum = b[i]
    for (let j = 0; j < x.length; j++) sum += x[j] * w[i][j]
    out[i] = sum
  }
  return out
}

function relu(x: number[]): number[] {
  return x.map(v => Math.max(0, v))
}

function layerNorm(x: number[], w: number[], b: number[]): number[] {
  let sum = 0
  for (let i = 0; i < x.length; i++) sum += x[i]
  const mean = sum / x.length
  let varSum = 0
  for (let i = 0; i < x.length; i++) varSum += (x[i] - mean) * (x[i] - mean)
  const variance = varSum / x.length
  const eps = 1e-5
  const out = new Array(x.length)
  for (let i = 0; i < x.length; i++) {
    out[i] = ((x[i] - mean) / Math.sqrt(variance + eps)) * w[i] + b[i]
  }
  return out
}

function forwardAuction(obs: number[], mask: boolean[]): number[] {
  const w = weights as any
  let x = obs
  x = linear(x, w['shared.0.weight'], w['shared.0.bias'])
  x = layerNorm(x, w['shared.1.weight'], w['shared.1.bias'])
  x = relu(x)
  
  x = linear(x, w['shared.3.weight'], w['shared.3.bias'])
  x = layerNorm(x, w['shared.4.weight'], w['shared.4.bias'])
  x = relu(x)
  
  const logits = linear(x, w['actor.weight'], w['actor.bias'])
  
  for (let i = 0; i < 4; i++) {
    if (!mask[i]) logits[i] = -1e9
  }
  return logits
}

function sampleAction(logits: number[], temperature = 0.6): number {
  const temp = Math.max(temperature, 1e-4)
  const scaled = logits.map(l => l / temp)
  const maxLogit = Math.max(...scaled)
  const exps = scaled.map(l => Math.exp(l - maxLogit))
  const sumExp = exps.reduce((a, b) => a + b, 0)
  const probs = exps.map(e => e / sumExp)
  
  const r = Math.random()
  let acc = 0
  for (let i = 0; i < probs.length; i++) {
    acc += probs[i]
    if (r <= acc) return i
  }
  return probs.length - 1
}

export function evaluateAuctionBot(
  seat: number,
  block: Block,
  squads: Record<number, Squad>,
  budgets: Record<number, number>,
  seatCount: number,
  lotsRevealedPerPos: number[],
  lotsSoldPerPos: number[],
  lotsRemaining: number,
  fractionElapsed: number,
  scopedPoolSize: number
): number | null {
  const myBudget = budgets[seat] ?? 0
  const lot = block.lot.player
  const lotPosIdx = positionToIndex(lot.position)
  
  const posOnehot = new Array(10).fill(0)
  posOnehot[lotPosIdx] = 1.0
  
  let priceOpeningRatio = 1.0
  if (block.lot.opening > 0) {
    priceOpeningRatio = Math.min(10.0, Math.max(0.0, block.price / block.lot.opening))
  }
  priceOpeningRatio /= 10.0
  
  const lotBlock = [
    lot.ability / NORM_ABILITY,
    ...posOnehot,
    lot.price / NORM_PRICE,
    block.lot.opening / NORM_PRICE,
    block.price / NORM_PRICE,
    priceOpeningRatio,
    Math.floor((block.lot.number - 1) / seatCount) / NORM_ROUNDS
  ]
  
  let budgetPriceRatio = 0
  if (block.price > 0) {
    budgetPriceRatio = Math.min(10.0, Math.max(0.0, myBudget / block.price))
  }
  budgetPriceRatio /= 10.0
  
  const amIHigh = block.holder === seat ? 1.0 : 0.0
  
  // Calculate squad stats for everyone
  const openSlots = new Array(seatCount).fill(0).map(() => new Array(10).fill(0))
  const bestAb = new Array(seatCount).fill(0).map(() => new Array(10).fill(0))
  const weakestAb = new Array(seatCount).fill(0).map(() => new Array(10).fill(0))
  
  for (let s = 0; s < seatCount; s++) {
    const sq = squads[s] ?? {}
    const counts = new Array(10).fill(0)
    for (const slot of formation) {
      const pid = positionToIndex(slot.position)
      const p = sq[slot.id]
      if (p) {
        counts[pid]++
        bestAb[s][pid] = Math.max(bestAb[s][pid], p.ability)
        if (weakestAb[s][pid] === 0) weakestAb[s][pid] = p.ability
        else weakestAb[s][pid] = Math.min(weakestAb[s][pid], p.ability)
      }
    }
    for (const slot of formation) {
      const pid = positionToIndex(slot.position)
      const targetCount = pid === positionToIndex('CB') ? 2 : 1
      openSlots[s][pid] = targetCount - counts[pid]
      if (openSlots[s][pid] > 0) {
        weakestAb[s][pid] = 0 // if there is an open slot, the weakest is 0
      }
    }
  }
  
  const myBestAb = bestAb[seat]
  const myOpen = openSlots[seat]
  
  const meBlock = [
    myBudget / NORM_PRICE,
    budgetPriceRatio,
    amIHigh,
    ...myBestAb.map(v => v / NORM_ABILITY),
    ...myOpen.map(v => v / 2.0)
  ]
  
  const weakest = weakestAb[seat][lotPosIdx]
  const delta = Math.max(0, lot.ability - weakest)
  const mv = delta * (POSITION_MULTIPLIERS[lot.position] ?? 1.0)
  const mvBlock = [mv / NORM_ABILITY]
  
  let oppMaxBudget = 0
  let oppSumBudget = 0
  let oppNeedPosCount = 0
  let oppMaxBudgetNeedPos = 0
  let oppFillSum = 0
  
  for (let s = 0; s < seatCount; s++) {
    if (s === seat) continue
    const b = budgets[s] ?? 0
    oppMaxBudget = Math.max(oppMaxBudget, b)
    oppSumBudget += b
    
    const needs = openSlots[s][lotPosIdx] > 0
    if (needs) {
      oppNeedPosCount++
      oppMaxBudgetNeedPos = Math.max(oppMaxBudgetNeedPos, b)
    }
    
    let filled = 0
    for (const v of openSlots[s]) filled += v
    oppFillSum += (11.0 - filled) / 11.0
  }
  
  const oppLiveCount = seatCount - 1
  const oppMeanBudget = oppLiveCount > 0 ? oppSumBudget / oppLiveCount : 0
  const oppMeanFill = oppLiveCount > 0 ? oppFillSum / oppLiveCount : 0
  
  const oppBlock = [
    oppLiveCount / 4.0,
    oppMaxBudget / NORM_PRICE,
    oppMeanBudget / NORM_PRICE,
    oppNeedPosCount / 4.0,
    oppMaxBudgetNeedPos / NORM_PRICE,
    oppMeanFill
  ]
  
  const histBlock = [
    ...lotsRevealedPerPos.map(v => v / NORM_LOTS),
    ...lotsSoldPerPos.map(v => v / NORM_LOTS),
    lotsRemaining / NORM_LOTS,
    fractionElapsed
  ]
  
  const ctxBlock = [scopedPoolSize / NORM_POOL]
  
  const obs = [...lotBlock, ...meBlock, ...mvBlock, ...oppBlock, ...histBlock, ...ctxBlock]
  
  const mask = [
    true, // Pass is always legal
    myBudget >= block.price + 5.0, // +5M
    myBudget >= block.price + 10.0, // +10M
    myBudget >= block.price + 25.0 // +25M
  ]
  
  // Also mask +5, +10, +25 if the lot is in its first round (opening phase) 
  // Wait! In Auction, if block.holder === null, only 0 or 1 (+0M) is allowed?
  // Let's check `legal` mask in python code:
  // r0 = self.round_idx == 0
  // If r0:
  // legal[r0_mask & c0, i, 1] = True (meaning action 1 is taking the opening price)
  // Actions 2 and 3 are False.
  // If not r0 (it's a raise phase):
  // action 1 = +5, action 2 = +10, action 3 = +25.
  if (block.holder === null) {
    mask[1] = myBudget >= block.lot.opening
    mask[2] = false
    mask[3] = false
  } else {
    // If I'm the high bidder, I can only pass
    if (block.holder === seat) {
      mask[1] = false
      mask[2] = false
      mask[3] = false
    }
  }
  
  const logits = forwardAuction(obs, mask)
  const action = sampleAction(logits, 0.6)
  
  if (action === 0) return null
  if (block.holder === null) return 0 // Action 1 in opening phase means accept opening bid
  if (action === 1) return 5
  if (action === 2) return 10
  if (action === 3) return 25
  return null
}