// GENERATED FILE — do not edit by hand.
// Produced by scripts/generate_viability_data.mjs from
// draft_config_simulation_results.csv (Monte Carlo shortage simulation).
//
// Every draft configuration was simulated against the real player pool to see
// whether it can actually seat a full 4-2-3-1 for everyone at the table. Since
// the position reform gave each footballer exactly one slot, supply at the
// scarcest position — not headcount — decides whether a config works, and a
// shared constraint can additionally deadlock a drafter mid-draft.
//
// Re-run 2026-08-23, and it had to be: constraints became a table-wide tally
// rather than a per-squad one, and the pool grew from 546 rows to 694. Either
// change on its own invalidates every number below.
//
// Viability is monotonic in lobby size (verified at generation time), so each
// entry is the LARGEST lobby size that configuration still completes at.
// A triple missing from this map never works, at any size.
//
// Key: `${formatId}|${scopeKey}|${constraintId}`
//   scopeKey:     'all' | 'top-5' | 'league:<leagueId>'
//   constraintId: the four offered constraints, plus 'none' (no constraint
//                 selected — simulated, but the lobby doesn't currently offer
//                 it as a chip) and 'na' (formats that don't take one).

export const maxViableLobbySize: Record<string, number> = {
  'auction|all|na': 5,
  'auction|league:bundesliga|na': 2,
  'auction|league:la-liga|na': 4,
  'auction|league:premier-league|na': 5,
  'auction|league:serie-a|na': 5,
  'auction|top-5|na': 5,
  'deal-or-no-deal|all|na': 5,
  'deal-or-no-deal|league:la-liga|na': 2,
  'deal-or-no-deal|league:premier-league|na': 3,
  'deal-or-no-deal|league:serie-a|na': 2,
  'deal-or-no-deal|top-5|na': 5,
  'free-pick|all|club-1': 5,
  'free-pick|all|club-3': 5,
  'free-pick|all|nation-1': 3,
  'free-pick|all|nation-3': 5,
  'free-pick|all|none': 5,
  'free-pick|league:bundesliga|none': 2,
  'free-pick|league:la-liga|none': 4,
  'free-pick|league:premier-league|club-3': 2,
  'free-pick|league:premier-league|nation-3': 2,
  'free-pick|league:premier-league|none': 5,
  'free-pick|league:serie-a|none': 5,
  'free-pick|top-5|club-1': 3,
  'free-pick|top-5|club-3': 5,
  'free-pick|top-5|nation-3': 5,
  'free-pick|top-5|none': 5,
  'spin-the-wheel|all|na': 5,
  'spin-the-wheel|league:bundesliga|na': 2,
  'spin-the-wheel|league:la-liga|na': 4,
  'spin-the-wheel|league:premier-league|na': 5,
  'spin-the-wheel|league:serie-a|na': 5,
  'spin-the-wheel|top-5|na': 5,
}
