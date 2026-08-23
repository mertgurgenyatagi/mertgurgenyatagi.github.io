// Turns draft_config_simulation_results.csv into src/data/draftViability.ts.
//
// The simulation proved viability is strictly monotonic in lobby size — a
// config that deadlocks at N also deadlocks at every size above N — so each
// (format, scope, constraint) triple compresses to a single number: the
// largest lobby size it still completes at. 0 (omitted from the emitted map)
// means it never works, at any size.
//
// Run after re-running the simulation:
//   node scripts/draft-data/generate_viability_data.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));

const FORMAT_IDS = {
  "Auction": "auction",
  "Deal or No Deal": "deal-or-no-deal",
  "Free Pick": "free-pick",
  "Spin the Wheel": "spin-the-wheel",
};

// CSV league name -> the league id the UI uses (which is also its crest filename).
const LEAGUE_IDS = {
  "Premier Division": "premier-league",
  "First Division": "la-liga",
  "Serie A": "serie-a",
  "Bundesliga": "bundesliga",
  "Ligue 1 Uber Eats": "ligue-1",
};

const CONSTRAINT_IDS = {
  "1 per club": "club-1",
  "3 per club": "club-3",
  "1 per nationality": "nation-1",
  "3 per nationality": "nation-3",
  "No constraints": "none",
  "Not applicable": "na",
};

function parseCsvLine(line) {
  const fields = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else { inQuotes = false; }
      } else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { fields.push(cur); cur = ""; }
    else cur += ch;
  }
  fields.push(cur);
  return fields;
}

// Scoping a draft to one nationality was withdrawn from the lobby on
// 2026-08-18: the simulation found no nationality can seat three drafters and
// only one can seat two, so it was cut rather than shipped permanently dimmed.
// Its rows stay in the results CSV as the evidence for that call, but they're
// dropped here so the shipped data carries nothing the UI can reach.
// (Per-nationality *constraints* are a different setting and are unaffected.)
function scopeKeyOf(csvScope) {
  if (csvScope === "All players") return "all";
  if (csvScope === "Top 5 leagues") return "top-5";
  if (csvScope.startsWith("League: ")) {
    const name = csvScope.slice("League: ".length);
    const id = LEAGUE_IDS[name];
    if (!id) throw new Error(`Unmapped league: ${name}`);
    return `league:${id}`;
  }
  if (csvScope.startsWith("Nationality: ")) return null;
  throw new Error(`Unmapped scope: ${csvScope}`);
}

const text = readFileSync(path.join(ROOT, "data", "draft_config_simulation_results.csv"), "utf8").replace(/\r\n/g, "\n");
const lines = text.split("\n").filter((l) => l.length > 0);
const header = parseCsvLine(lines[0]);
const rows = lines.slice(1).map((l) => {
  const f = parseCsvLine(l);
  const o = {};
  header.forEach((h, i) => { o[h] = f[i]; });
  return o;
});

// triple key -> max size that came back OK
const maxSize = new Map();
for (const r of rows) {
  const format = FORMAT_IDS[r.Format];
  const constraint = CONSTRAINT_IDS[r.Constraint];
  if (!format) throw new Error(`Unmapped format: ${r.Format}`);
  if (!constraint) throw new Error(`Unmapped constraint: ${r.Constraint}`);
  const scopeKey = scopeKeyOf(r.Scope);
  if (scopeKey === null) continue;
  const key = `${format}|${scopeKey}|${constraint}`;
  const size = Number(r["Lobby size"]);
  if (r.Result !== "OK") continue;
  maxSize.set(key, Math.max(maxSize.get(key) ?? 0, size));
}

// Sanity: re-verify monotonicity against the source rows rather than trusting
// the earlier ad-hoc check — if a config is OK at size N it must be OK at every
// size below N, otherwise a single max number silently loses information.
const byTriple = new Map();
for (const r of rows) {
  const scopeKey = scopeKeyOf(r.Scope);
  if (scopeKey === null) continue;
  const key = `${FORMAT_IDS[r.Format]}|${scopeKey}|${CONSTRAINT_IDS[r.Constraint]}`;
  if (!byTriple.has(key)) byTriple.set(key, {});
  byTriple.get(key)[Number(r["Lobby size"])] = r.Result === "OK";
}
for (const [key, sizes] of byTriple) {
  const max = maxSize.get(key) ?? 0;
  for (let s = 2; s <= 5; s++) {
    const expected = s <= max;
    if (Boolean(sizes[s]) !== expected) {
      throw new Error(`Non-monotonic viability for ${key}: ${JSON.stringify(sizes)} (max ${max})`);
    }
  }
}

const entries = [...maxSize.entries()].filter(([, v]) => v > 0).sort(([a], [b]) => a.localeCompare(b));

const body = entries.map(([k, v]) => `  '${k}': ${v},`).join("\n");

const out = `// GENERATED FILE — do not edit by hand.
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
// Key: \`\${formatId}|\${scopeKey}|\${constraintId}\`
//   scopeKey:     'all' | 'top-5' | 'league:<leagueId>'
//   constraintId: the four offered constraints, plus 'none' (no constraint
//                 selected — simulated, but the lobby doesn't currently offer
//                 it as a chip) and 'na' (formats that don't take one).

export const maxViableLobbySize: Record<string, number> = {
${body}
}
`;

writeFileSync(path.join(ROOT, "src/data/draftViability.ts"), out, "utf8");
console.log(`Wrote src/data/draftViability.ts — ${entries.length} viable triples of ${byTriple.size} total.`);
