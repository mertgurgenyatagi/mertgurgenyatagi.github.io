#!/usr/bin/env node
'use strict';

const fs   = require('fs');
const path = require('path');

const dir    = path.join(__dirname, '..', 'kupatakip');
const dataJs = fs.readFileSync(path.join(dir, 'data.js'), 'utf8');
const { TR_TO_EN, EN_TO_TR, BRACKET, PREDICTIONS, PARTICIPANTS, ROUND_POINTS } =
  new Function(dataJs + '\nreturn { TR_TO_EN, EN_TO_TR, BRACKET, PREDICTIONS, PARTICIPANTS, ROUND_POINTS };')();

// Scenario: winner of each remaining match, in bracket order
const SCENARIO = [
  'Spain',         // match_19: Portugal vs Spain
  'United States', // match_20: USA vs Belgium
  'Argentina',     // match_23: Argentina vs Egypt
  'Colombia',      // match_24: Switzerland vs Colombia
  'France',        // match_25: France vs Morocco   (QF)
  'Spain',         // match_26: Spain vs USA         (QF)
  'England',       // match_27: Norway vs England    (QF) — Brazil already eliminated by Norway
  'Argentina',     // match_28: Argentina vs Colombia (QF)
  'France',        // match_29: France vs Spain      (SF)
  'England',       // match_30: England vs Argentina (SF)
  'France',        // match_31: France vs England    (Final)
];

const MATCH_ORDER = Array.from({ length: 31 }, (_, i) => `match_${i + 1}`);

// Clone current results and fill in scenario
const results = { ...JSON.parse(fs.readFileSync(path.join(dir, 'results.json'), 'utf8')) };

// Resolve bracket iteratively so we can determine home/away for each match
const winners = {};
function resolve(id) {
  if (id in winners) return;
  const m = BRACKET[id];
  if (m.homeFrom) resolve(m.homeFrom);
  if (m.awayFrom) resolve(m.awayFrom);
  const home = m.round === 'RO32' ? m.home : (winners[m.homeFrom] ?? null);
  const away = m.round === 'RO32' ? m.away : (winners[m.awayFrom] ?? null);

  if (results[id] != null) {
    winners[id] = results[id] === 1 ? home : away;
    return;
  }

  // Apply scenario in order for pending matches
  const scenarioWinner = SCENARIO.shift();
  if (!scenarioWinner) return;

  if (!home || !away) {
    console.error(`Cannot resolve teams for ${id}`);
    process.exit(1);
  }
  if (scenarioWinner !== home && scenarioWinner !== away) {
    console.error(`Scenario winner "${scenarioWinner}" is not playing in ${id} (${home} vs ${away})`);
    process.exit(1);
  }

  results[id] = scenarioWinner === home ? 1 : 2;
  winners[id] = scenarioWinner;
  console.log(`${id.padEnd(10)} ${home} vs ${away} → ${scenarioWinner}`);
}
MATCH_ORDER.forEach(resolve);

// ── Compute scores ──────────────────────────────────────────
const teamsInRO16  = new Set(['match_1','match_2','match_3','match_4','match_5','match_6','match_7','match_8','match_9','match_10','match_11','match_12','match_13','match_14','match_15','match_16'].map(id => winners[id]).filter(Boolean));
const teamsInQF    = new Set(['match_17','match_18','match_19','match_20','match_21','match_22','match_23','match_24'].map(id => winners[id]).filter(Boolean));
const teamsInSF    = new Set(['match_25','match_26','match_27','match_28'].map(id => winners[id]).filter(Boolean));
const teamsInFinal = new Set(['match_29','match_30'].map(id => winners[id]).filter(Boolean));
const champion     = winners['match_31'];

const scores = {};
PARTICIPANTS.forEach(name => {
  const p    = PREDICTIONS[name];
  const toEn = t => TR_TO_EN[t] || t;
  let pts = 0, breakdown = { ro16: 0, qf: 0, sf: 0, final: 0, champion: 0 };

  p.ro16.forEach(t    => { if (teamsInRO16.has(toEn(t)))  { pts += 1; breakdown.ro16 += 1; }});
  p.qf.forEach(t      => { if (teamsInQF.has(toEn(t)))    { pts += 2; breakdown.qf   += 2; }});
  p.sf.forEach(t      => { if (teamsInSF.has(toEn(t)))    { pts += 3; breakdown.sf   += 3; }});
  p.final.forEach(t   => { if (teamsInFinal.has(toEn(t))) { pts += 5; breakdown.final += 5; }});
  if (champion && toEn(p.champion) === champion)           { pts += 8; breakdown.champion = 8; }

  scores[name] = { pts, breakdown };
});

// ── Print leaderboard ───────────────────────────────────────
console.log('\n─────────────────────────────────────────────────────────────────');
console.log(`Champion: ${EN_TO_TR[champion] || champion}`);
console.log('─────────────────────────────────────────────────────────────────');
console.log('Rank  Name                      Pts   Son16 QF  SF  Final  Şamp');
console.log('─────────────────────────────────────────────────────────────────');

const sorted = Object.entries(scores).sort((a, b) => b[1].pts - a[1].pts);
sorted.forEach(([name, s], i) => {
  const b = s.breakdown;
  console.log(
    `${String(i+1).padStart(3)}.  ${name.padEnd(25)} ${String(s.pts).padStart(3)}   ` +
    `${String(b.ro16).padStart(3)}   ${String(b.qf).padStart(2)}  ${String(b.sf).padStart(2)}    ${String(b.final).padStart(2)}     ${b.champion || '-'}`
  );
});
