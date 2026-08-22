import { maxViableLobbySize } from '../data/draftViability'
import { formats } from '../data/formats'
import { MIN_SEATS, constraints, leagues, scopes } from '../data/lobbyOptions'

const formatIds = formats.map((entry) => entry.id)

/**
 * Which draft configurations a given table can actually seat.
 *
 * Since every footballer now fills exactly one slot, a draft's ceiling is set
 * by supply at its scarcest position rather than by headcount — and under Free
 * Pick a per-squad constraint can strand a drafter partway through even when
 * the raw supply looks fine. Both were measured by simulating every
 * configuration against the real pool; `../data/draftViability` is that result,
 * one number per configuration: the largest table it still completes at.
 *
 * The lobby reads this to decide what to offer. Nothing here reports *why* a
 * configuration tops out where it does — pool depth is implementation state and
 * stays off screen. What the lobby says is only ever how many seats an option
 * supports.
 */

/** The one scope that narrows further; the other two stand alone. */
const NARROWING_LEAGUE = 'league'

/**
 * The key a configuration is stored under. Scope collapses to one string so a
 * narrowed scope ("one league", Serie A) is a single lookup rather than a
 * special case at every call site.
 */
export function scopeKeyOf(scope: string, league: string): string {
  if (scope === NARROWING_LEAGUE) return `league:${league}`
  return scope
}

/** Constraints are a Free Pick setting and are not offered anywhere else. */
export function takesConstraint(format: string | null): boolean {
  return format === 'free-pick'
}

/**
 * The constraint ids that actually reach the screen for this format. The
 * simulation also covers running Free Pick with no constraint at all, which is
 * more permissive than any of the four — but the lobby has no chip for it, so
 * counting it here would advertise room the host can't reach.
 */
function offeredConstraintIds(format: string | null): string[] {
  return takesConstraint(format) ? constraints.map((entry) => entry.id) : ['na']
}

/** Largest table this exact configuration can seat. 0 = it never works. */
export function maxSizeForConfig(
  format: string | null,
  key: string,
  constraintId: string,
): number {
  if (!format) return 0
  return maxViableLobbySize[`${format}|${key}|${constraintId}`] ?? 0
}

/** Largest table this scope can seat under any constraint the lobby offers. */
export function maxSizeForScope(format: string | null, key: string): number {
  let best = 0
  for (const constraintId of offeredConstraintIds(format)) {
    best = Math.max(best, maxSizeForConfig(format, key, constraintId))
  }
  return best
}

/**
 * A table below the two-drafter minimum can't start anyway, and the simulation
 * never modelled one. Judging availability against 2 there keeps a one-seat
 * lobby from briefly advertising options that vanish the moment someone joins.
 */
export function effectiveSize(seatCount: number): number {
  return Math.max(seatCount, MIN_SEATS)
}

/*
 * Until a format is chosen nothing is ruled out yet, so the checks below
 * report everything as available rather than dimming the whole panel at once.
 * A screen that opens with every option struck through reads as broken; an
 * unpicked format is simply an unanswered question.
 */

export function isScopeAvailable(
  format: string | null,
  scopeId: string,
  size: number,
): boolean {
  if (!format) return true
  if (scopeId === NARROWING_LEAGUE) {
    return leagues.some((entry) => maxSizeForScope(format, `league:${entry.id}`) >= size)
  }
  return maxSizeForScope(format, scopeId) >= size
}

export function isLeagueAvailable(format: string | null, leagueId: string, size: number): boolean {
  if (!format) return true
  return maxSizeForScope(format, `league:${leagueId}`) >= size
}

export function isConstraintAvailable(
  format: string | null,
  key: string,
  constraintId: string,
  size: number,
): boolean {
  if (!format) return true
  // A format that takes no constraint collapses the whole group away; nothing
  // in it is "unavailable", it simply isn't part of this draft.
  if (!takesConstraint(format)) return true
  return maxSizeForConfig(format, key, constraintId) >= size
}

/** A format is on offer while any scope it can be played at still fits. */
export function isFormatAvailable(format: string, size: number): boolean {
  return scopes.some((entry) => isScopeAvailable(format, entry.id, size))
}

export function isConfigViable(
  format: string | null,
  scope: string,
  league: string,
  constraint: string,
  size: number,
): boolean {
  if (!format) return false
  const key = scopeKeyOf(scope, league)
  const constraintId = takesConstraint(format) ? constraint : 'na'
  return maxSizeForConfig(format, key, constraintId) >= size
}

const NUMBER_WORDS: Record<number, string> = {
  1: 'one',
  2: 'two',
  3: 'three',
  4: 'four',
  5: 'five',
}

export function seatsPhrase(size: number): string {
  return `${NUMBER_WORDS[size] ?? size} at the table`
}

/** What the chosen scope is called in a sentence. */
function scopeLabel(scope: string, league: string): string {
  if (scope === NARROWING_LEAGUE) {
    return leagues.find((entry) => entry.id === league)?.name ?? 'That league'
  }
  return scopes.find((entry) => entry.id === scope)?.name ?? 'That scope'
}

/**
 * The resting status line for a table that can't play what it's set to.
 *
 * Names the one setting that actually doesn't fit, rather than the whole
 * configuration — the constraint is blamed only when the scope itself would
 * otherwise have been fine, so the message points at the thing worth changing.
 */
export function unavailableReason(
  format: string | null,
  scope: string,
  league: string,
  constraint: string,
  size: number,
): string {
  if (!format) return ''
  if (isConfigViable(format, scope, league, constraint, size)) return ''

  const key = scopeKeyOf(scope, league)
  const phrase = seatsPhrase(size)

  // Purely descriptive: the friends lobby fills with people the host can't
  // remove, so telling anyone to free a seat isn't always advice they can take.
  // The chips already show what a table this size can play.
  if (takesConstraint(format) && maxSizeForScope(format, key) >= size) {
    const name = constraints.find((entry) => entry.id === constraint)?.name ?? 'That constraint'
    return `${name} doesn’t support ${phrase}.`
  }

  return `${scopeLabel(scope, league)} doesn’t support ${phrase}.`
}

/** True when anything currently on screen is dimmed for want of seats. */
export function hasDimmedOptions(
  format: string | null,
  scope: string,
  league: string,
  size: number,
): boolean {
  if (!format) return false
  if (formatIds.some((id) => !isFormatAvailable(id, size))) return true
  if (scopes.some((entry) => !isScopeAvailable(format, entry.id, size))) return true
  if (scope === NARROWING_LEAGUE) {
    if (leagues.some((entry) => !isLeagueAvailable(format, entry.id, size))) return true
  }
  if (takesConstraint(format)) {
    const key = scopeKeyOf(scope, league)
    if (constraints.some((entry) => !isConstraintAvailable(format, key, entry.id, size))) return true
  }
  return false
}
