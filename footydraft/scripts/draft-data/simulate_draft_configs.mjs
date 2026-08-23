// Monte Carlo shortage test for every row in draft_config_permutations.csv.
//
// For each (Format, Scope, Constraint, Lobby size) config, runs up to
// MAX_SIMULATIONS simulated drafts against the real player_data.csv pool. The
// moment one simulation produces a shortage (a drafter reaches a turn with an
// unfilled slot and zero legal remaining picks for it), the config is flagged
// SHORTAGE and the rest of its simulation budget is skipped. A config that
// completes MAX_SIMULATIONS clean is flagged OK.
//
// Modeling notes (PROJECT.md doesn't pin every mechanical detail down, so
// these are the simplifications this script makes — read before trusting the
// output for anything Mert hasn't explicitly confirmed):
//
// - Positions are a hard gate (R7.3-Q1): a footballer only ever fills the one
//   slot in their Position column. Every format's demand/supply is therefore
//   split into ten independent position pools that never compete with each
//   other.
// - Auction: no bidding strategy is specced (bot decision logic is
//   explicitly deferred), so this models a neutral baseline where drafters
//   only ever buy what they still need, direct-to-slot, no deliberate
//   overflow/blocking purchases. Under a hard gate this is fully
//   deterministic per position (count >= lobbySize * need), so Auction rows
//   will agree across every simulation — there is no real strategy-driven
//   shortage risk to Monte Carlo here without inventing an unspecced bidding
//   model, and this script doesn't invent one.
// - Free Pick: an actual randomized snake draft. Each turn the current
//   drafter picks uniformly at random among players who (a) fill a slot they
//   still need and (b) satisfy the TABLE'S shared constraint (2026-08-23:
//   constraints are shared, overturning R6-Q3's per-squad reading). This is
//   the one format where pick
//   order genuinely matters — a drafter can lock themselves out of their own
//   needed slot under "1/3 per club/nationality" even when raw supply at
//   that position exists elsewhere in the pool.
// - Spin the Wheel: modeled identically to Free Pick with no constraint
//   (Spin the Wheel doesn't support Constraints, R5-Q2). The wheel's
//   empty-category fallback means a spin can never permanently remove supply
//   the way a stuck slot can — worst case it behaves exactly like an
//   unrestricted free pick that turn — so this is a fair, slightly
//   conservative proxy rather than a full wheel-mechanics simulation.
// - Deal or No Deal: the 11 formation slots (CB appears twice) are processed
//   in random order. Each round requires at least 2 * lobbySize remaining
//   players at that round's position (the "n*2 boxes" rule) and consumes
//   exactly lobbySize of them (one per drafter). The AI-proposer's offered
//   player — described as "not in any box" — isn't modeled as a further draw
//   from the pool; PROJECT.md doesn't pin down its exact resourcing, and
//   guessing would fabricate a rule rather than test one.
//
// Usage: node scripts/draft-data/simulate_draft_configs.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const MAX_SIMULATIONS = 5000;

const SLOT_NEEDS = {
  GK: 1, CB: 2, LB: 1, RB: 1, CDM: 1, CM: 1, AMF: 1, LW: 1, RW: 1, ST: 1,
};
const SLOTS = Object.keys(SLOT_NEEDS);
// 11 literal formation slots for Deal or No Deal round construction (CB twice).
const FORMATION_SLOTS = ["GK", "CB", "CB", "LB", "RB", "CDM", "CM", "AMF", "LW", "RW", "ST"];
const TOP5 = new Set(["Serie A", "Premier Division", "First Division", "Bundesliga", "Ligue 1 Uber Eats"]);

function parseCsvLine(line) {
  // Minimal quoted-field CSV parser (handles "a, b" style fields).
  const fields = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else { inQuotes = false; }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

function loadCsv(filePath) {
  const text = readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
  const lines = text.split("\n").filter((l) => l.length > 0);
  const header = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const fields = parseCsvLine(line);
    const row = {};
    header.forEach((h, i) => { row[h] = fields[i]; });
    return row;
  });
}

function loadPlayers() {
  const rows = loadCsv(path.join(ROOT, "data", "player_data.csv"));
  return rows.map((r) => ({ pos: r.Position, club: r.Club, nation: r.Nation, league: r.League }));
}

function scopedPool(allPlayers, scope) {
  if (scope === "All players") return allPlayers;
  if (scope === "Top 5 leagues") return allPlayers.filter((p) => TOP5.has(p.league));
  if (scope.startsWith("League: ")) {
    const league = scope.slice("League: ".length);
    return allPlayers.filter((p) => p.league === league);
  }
  if (scope.startsWith("Nationality: ")) {
    const nation = scope.slice("Nationality: ".length);
    return allPlayers.filter((p) => p.nation === nation);
  }
  throw new Error(`Unrecognized scope: ${scope}`);
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Constraints are counted against the WHOLE TABLE, not one squad (set by
// Mert, 2026-08-23, overturning R6-Q3). Under "1 per club", one Real Madrid
// footballer going anywhere at the table takes Real Madrid off everybody's
// board. `counts` is therefore a single shared tally rather than the picking
// drafter's own -- which makes every constrained configuration dramatically
// tighter than it was when this script last ran, and is the whole reason it
// had to be re-run.
function constraintOk(counts, player, constraint) {
  if (constraint === "1 per club") return (counts.clubCounts.get(player.club) || 0) < 1;
  if (constraint === "3 per club") return (counts.clubCounts.get(player.club) || 0) < 3;
  if (constraint === "1 per nationality") return (counts.nationCounts.get(player.nation) || 0) < 1;
  if (constraint === "3 per nationality") return (counts.nationCounts.get(player.nation) || 0) < 3;
  return true; // "No constraints" / "Not applicable"
}

function makeSquad() {
  return { filled: Object.fromEntries(SLOTS.map((s) => [s, 0])), clubCounts: new Map(), nationCounts: new Map(), totalPicks: 0 };
}

function assign(squad, player) {
  squad.filled[player.pos]++;
  squad.clubCounts.set(player.club, (squad.clubCounts.get(player.club) || 0) + 1);
  squad.nationCounts.set(player.nation, (squad.nationCounts.get(player.nation) || 0) + 1);
  squad.totalPicks++;
}

function needsSlot(squad, pos) {
  return squad.filled[pos] < SLOT_NEEDS[pos];
}

function isSquadFull(squad) {
  return squad.totalPicks >= 11;
}

// Free Pick, and (with constraint forced to "Not applicable") Spin the Wheel.
function simulateFreePick(pool, lobbySize, constraint, rng) {
  const remaining = pool.slice();
  const squads = Array.from({ length: lobbySize }, makeSquad);
  // The table's shared constraint tally -- see constraintOk above.
  const table = { clubCounts: new Map(), nationCounts: new Map() };
  const order = shuffle([...Array(lobbySize).keys()], rng);

  for (let round = 0; round < 11; round++) {
    const roundOrder = round % 2 === 0 ? order : order.slice().reverse();
    for (const drafter of roundOrder) {
      const squad = squads[drafter];
      if (isSquadFull(squad)) continue;
      const legal = [];
      for (let i = 0; i < remaining.length; i++) {
        const p = remaining[i];
        if (needsSlot(squad, p.pos) && constraintOk(table, p, constraint)) legal.push(i);
      }
      if (legal.length === 0) {
        return { shortage: true, detail: `Free Pick: drafter ${drafter} had no legal pick in round ${round + 1}` };
      }
      const idx = legal[Math.floor(rng() * legal.length)];
      const chosen = remaining[idx];
      assign(squad, chosen);
      table.clubCounts.set(chosen.club, (table.clubCounts.get(chosen.club) || 0) + 1);
      table.nationCounts.set(chosen.nation, (table.nationCounts.get(chosen.nation) || 0) + 1);
      remaining.splice(idx, 1);
    }
  }
  return { shortage: false };
}

// Auction: neutral baseline (no deliberate overflow/blocking). Deterministic
// per position under a hard gate, run through the same turn-taking shape for
// consistency with the other formats.
function simulateAuction(pool, lobbySize, rng) {
  const remaining = pool.slice();
  const squads = Array.from({ length: lobbySize }, makeSquad);
  let active = [...Array(lobbySize).keys()];

  while (active.length > 0) {
    active = shuffle(active, rng);
    let anyPick = false;
    for (const drafter of active) {
      const squad = squads[drafter];
      const legal = [];
      for (let i = 0; i < remaining.length; i++) {
        if (needsSlot(squad, remaining[i].pos)) legal.push(i);
      }
      if (legal.length > 0) {
        const idx = legal[Math.floor(rng() * legal.length)];
        assign(squad, remaining[idx]);
        remaining.splice(idx, 1);
        anyPick = true;
      }
    }
    active = active.filter((d) => !isSquadFull(squads[d]));
    if (!anyPick && active.length > 0) {
      const short = active.find((d) => SLOTS.some((s) => needsSlot(squads[d], s)));
      return { shortage: true, detail: `Auction: drafter ${short} left with unfillable slot(s), backfill has no eligible unsold player` };
    }
  }
  return { shortage: false };
}

// Deal or No Deal: 11 formation slots (CB twice) in random order, each round
// needs 2*lobbySize remaining players at that position and consumes lobbySize.
function simulateDealOrNoDeal(pool, lobbySize, rng) {
  const counts = {};
  for (const s of SLOTS) counts[s] = 0;
  for (const p of pool) counts[p.pos] = (counts[p.pos] || 0) + 1;

  const rounds = shuffle(FORMATION_SLOTS.slice(), rng);
  for (let r = 0; r < rounds.length; r++) {
    const pos = rounds[r];
    if (counts[pos] < 2 * lobbySize) {
      return { shortage: true, detail: `Deal or No Deal: round ${r + 1} (${pos}) needed ${2 * lobbySize} boxes, only ${counts[pos]} eligible remained` };
    }
    counts[pos] -= lobbySize;
  }
  return { shortage: false };
}

function runSimulations(format, pool, lobbySize, constraint, seedBase) {
  let simsRun = 0;
  for (let i = 0; i < MAX_SIMULATIONS; i++) {
    const rng = mulberry32(seedBase + i);
    let result;
    if (format === "Free Pick") result = simulateFreePick(pool, lobbySize, constraint, rng);
    else if (format === "Spin the Wheel") result = simulateFreePick(pool, lobbySize, "Not applicable", rng);
    else if (format === "Auction") result = simulateAuction(pool, lobbySize, rng);
    else if (format === "Deal or No Deal") result = simulateDealOrNoDeal(pool, lobbySize, rng);
    else throw new Error(`Unknown format: ${format}`);
    simsRun++;
    if (result.shortage) {
      return { result: "SHORTAGE", simsRun, detail: result.detail };
    }
  }
  return { result: "OK", simsRun, detail: "" };
}

function formatDuration(ms) {
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}m${String(s).padStart(2, "0")}s`;
  if (m > 0) return `${m}m${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

const BAR_WIDTH = 30;

function renderBar(done, total) {
  const pct = total === 0 ? 1 : done / total;
  const filled = Math.round(pct * BAR_WIDTH);
  return "#".repeat(filled) + "-".repeat(BAR_WIDTH - filled);
}

// Live progress reporter. Uses a self-overwriting carriage-return line on a
// real terminal; falls back to periodic plain log lines when stdout is
// redirected (a `\r`-driven bar is unreadable in a piped/logged output).
function makeProgressReporter(total, t0) {
  const isTTY = Boolean(process.stdout.isTTY);
  let lastPlainLog = 0;

  return function report(done, shortageCount, currentLabel, { force = false } = {}) {
    const elapsed = Date.now() - t0;
    const pct = total === 0 ? 100 : (done / total) * 100;
    const eta = done > 0 ? formatDuration((elapsed / done) * (total - done)) : "--";

    if (isTTY) {
      const bar = renderBar(done, total);
      const okCount = done - shortageCount;
      let line = `[${bar}] ${pct.toFixed(1)}% (${done}/${total}) | OK ${okCount} SHORTAGE ${shortageCount} | elapsed ${formatDuration(elapsed)} | eta ${eta} | ${currentLabel}`;
      const width = process.stdout.columns || 120;
      if (line.length > width) line = line.slice(0, width - 1);
      process.stdout.write("\r" + line.padEnd(width, " "));
      if (done === total) process.stdout.write("\n");
    } else {
      // Plain fallback: log at most once every ~2s, plus always on force (start/end).
      if (force || elapsed - lastPlainLog >= 2000) {
        lastPlainLog = elapsed;
        const okCount = done - shortageCount;
        console.log(`${pct.toFixed(1)}% (${done}/${total}) | OK ${okCount} SHORTAGE ${shortageCount} | elapsed ${formatDuration(elapsed)} | eta ${eta}`);
      }
    }
  };
}

// A SHORTAGE result is permanent — once a config is proven to deadlock at
// some simulation budget, a bigger budget can't un-prove it. Only a config
// that survived every prior run clean actually benefits from more attempts.
// So: load whatever's already in the results file (if any) and skip
// re-simulating anything already marked SHORTAGE there, carrying its row
// forward untouched. Everything else (previously OK, or never tested) gets
// freshly simulated at the current MAX_SIMULATIONS.
function loadPreviousResults(filePath) {
  let rows;
  try {
    rows = loadCsv(filePath);
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
  const map = new Map();
  for (const r of rows) {
    map.set(`${r.Format}|${r.Scope}|${r.Constraint}|${r["Lobby size"]}`, r);
  }
  return map;
}

function main() {
  const t0 = Date.now();
  const allPlayers = loadPlayers();
  const configs = loadCsv(path.join(ROOT, "data", "draft_config_permutations.csv"));
  const resultsPath = path.join(ROOT, "data", "draft_config_simulation_results.csv");
  const previous = loadPreviousResults(resultsPath);

  console.log(`Running up to ${MAX_SIMULATIONS.toLocaleString()} simulations per config across ${configs.length} configs...`);
  if (previous) {
    console.log(`Found prior results at ${path.basename(resultsPath)} — configs already proven SHORTAGE there will be carried forward, not re-simulated.`);
  }

  // Scope pools are expensive-ish to build and only depend on the Scope
  // column (68 distinct values across 2176 rows) — cache them.
  const scopeCache = new Map();
  function getPool(scope) {
    if (!scopeCache.has(scope)) scopeCache.set(scope, scopedPool(allPlayers, scope));
    return scopeCache.get(scope);
  }

  const out = ["Format,Scope,Constraint,Lobby size,Result,Simulations run,Detail"];
  let shortageCount = 0;
  let skippedCount = 0;
  let seed = 1;
  const report = makeProgressReporter(configs.length, t0);

  let done = 0;
  for (const row of configs) {
    const format = row.Format;
    const scope = row.Scope;
    const constraint = row.Constraint;
    const lobbySize = Number(row["Lobby size"]);
    const label = `${format}, ${scope}, ${constraint}, ${lobbySize}`;

    const prior = previous?.get(`${format}|${scope}|${constraint}|${lobbySize}`);
    if (prior && prior.Result === "SHORTAGE") {
      shortageCount++;
      skippedCount++;
      done++;
      const note = prior.Detail ? `${prior.Detail} [carried forward from prior run — not re-tested at ${MAX_SIMULATIONS.toLocaleString()}]` : "";
      const detailEscaped = note.includes(",") ? `"${note.replace(/"/g, '""')}"` : note;
      out.push(`${format},${scope},${constraint},${lobbySize},SHORTAGE,${prior["Simulations run"]},${detailEscaped}`);
      report(done, shortageCount, `${label} (skipped, already SHORTAGE)`);
      continue;
    }

    const pool = getPool(scope);
    report(done, shortageCount, label);

    const { result, simsRun, detail } = runSimulations(format, pool, lobbySize, constraint, seed);
    seed += MAX_SIMULATIONS;
    if (result === "SHORTAGE") shortageCount++;
    done++;

    const detailEscaped = detail.includes(",") ? `"${detail.replace(/"/g, '""')}"` : detail;
    out.push(`${format},${scope},${constraint},${lobbySize},${result},${simsRun},${detailEscaped}`);
  }
  report(done, shortageCount, "done", { force: true });

  writeFileSync(path.join(ROOT, "data", "draft_config_simulation_results.csv"), out.join("\n") + "\n", "utf8");

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const freshlyRun = configs.length - skippedCount;
  console.log(`${configs.length} configs total in ${elapsed}s — ${shortageCount} SHORTAGE, ${configs.length - shortageCount} OK. (${freshlyRun} freshly simulated, ${skippedCount} carried forward as already-proven SHORTAGE)`);
  console.log(`Written to draft_config_simulation_results.csv`);
}

main();
