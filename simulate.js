#!/usr/bin/env node
'use strict';

const fs   = require('fs');
const path = require('path');
const dir  = path.join(__dirname, 'kupatakip');

// ── Load game data ─────────────────────────────────────────
const dataJs = fs.readFileSync(path.join(dir, 'data.js'), 'utf8');
const { TR_TO_EN, BRACKET, PREDICTIONS, PARTICIPANTS } = new Function(
  dataJs + '\nreturn { TR_TO_EN, BRACKET, PREDICTIONS, PARTICIPANTS };'
)();

const results = JSON.parse(fs.readFileSync(path.join(dir, 'results.json'), 'utf8'));
delete results._comment;

// ── Match ordering (must be in dependency order) ───────────
const MATCH_IDS = [
  'match_1','match_2','match_3','match_4','match_5','match_6','match_7','match_8',
  'match_9','match_10','match_11','match_12','match_13','match_14','match_15','match_16',
  'match_17','match_18','match_19','match_20','match_21','match_22','match_23','match_24',
  'match_25','match_26','match_27','match_28',
  'match_29','match_30',
  'match_32'
];
const M = MATCH_IDS.length; // 31

// ── Index all team names as integers ──────────────────────
const TEAM_LIST = (() => {
  const s = new Set();
  for (const m of Object.values(BRACKET))
    if (m.round === 'RO32') { s.add(m.home); s.add(m.away); }
  return [...s];
})();
const TEAM_IDX = Object.fromEntries(TEAM_LIST.map((t, i) => [t, i]));
const T = TEAM_LIST.length; // 32

const toIdx = t => { const e = TR_TO_EN[t] || t; return TEAM_IDX[e] ?? -1; };

// ── Pre-build match plan as typed arrays ──────────────────
// These live on the stack / in typed memory — no JS objects in the hot path.
const P_IS_RO32    = new Uint8Array(M);
const P_HOME       = new Int16Array(M);   // team index for RO32 home, else -1
const P_AWAY       = new Int16Array(M);
const P_HOME_FROM  = new Int16Array(M);   // index into MATCH_IDS, or -1
const P_AWAY_FROM  = new Int16Array(M);
const P_RESULT     = new Int8Array(M);    // 1 / 2 if known, 0 if unplayed
const P_RNGSLOT    = new Int8Array(M).fill(-1); // index into the random outcomes array

const unplayedMatchIndices = [];
MATCH_IDS.forEach((id, mi) => {
  const m = BRACKET[id];
  P_IS_RO32[mi]   = m.round === 'RO32' ? 1 : 0;
  P_HOME[mi]      = m.round === 'RO32' ? (TEAM_IDX[m.home] ?? -1) : -1;
  P_AWAY[mi]      = m.round === 'RO32' ? (TEAM_IDX[m.away] ?? -1) : -1;
  P_HOME_FROM[mi] = m.homeFrom ? MATCH_IDS.indexOf(m.homeFrom) : -1;
  P_AWAY_FROM[mi] = m.awayFrom ? MATCH_IDS.indexOf(m.awayFrom) : -1;
  P_RESULT[mi]    = results[id] != null ? results[id] : 0;
  if (results[id] == null) {
    P_RNGSLOT[mi] = unplayedMatchIndices.length;
    unplayedMatchIndices.push(mi);
  }
});
const NUM_UNPLAYED = unplayedMatchIndices.length;

// ── Pre-build participant predictions as typed arrays ─────
const NP = PARTICIPANTS.length;
// Predictions stored as flat typed arrays for cache efficiency
// Row pi: 16 RO16 team indices, 8 QF, 4 SF, 2 Final, 1 Champ = 31 total
const PRED_OFFSETS = { ro16: 0, qf: 16, sf: 24, final: 28, champ: 30 };
const PRED_DATA    = new Int16Array(NP * 31).fill(-1);

PARTICIPANTS.forEach((name, pi) => {
  const p = PREDICTIONS[name];
  const base = pi * 31;
  p.ro16.forEach((t, i) => { PRED_DATA[base + 0  + i] = toIdx(t); });
  p.qf.forEach(  (t, i) => { PRED_DATA[base + 16 + i] = toIdx(t); });
  p.sf.forEach(  (t, i) => { PRED_DATA[base + 24 + i] = toIdx(t); });
  p.final.forEach((t,i) => { PRED_DATA[base + 28 + i] = toIdx(t); });
  PRED_DATA[base + 30] = toIdx(p.champion);
});

// ── Reusable simulation buffers (zero heap alloc in hot loop) ──
const W         = new Int16Array(M).fill(-1); // winner team index per match
const RO16_MEM  = new Uint8Array(T);
const QF_MEM    = new Uint8Array(T);
const SF_MEM    = new Uint8Array(T);
const FINAL_MEM = new Uint8Array(T);
const RNG       = new Uint8Array(NUM_UNPLAYED); // random 1/2 per unplayed match

// ── Compute current scores (known results only) ────────────
function currentScoreFromBuffers() {
  W.fill(-1);
  for (let mi = 0; mi < M; mi++) {
    const home = P_IS_RO32[mi] ? P_HOME[mi] : (P_HOME_FROM[mi] >= 0 ? W[P_HOME_FROM[mi]] : -1);
    const away = P_IS_RO32[mi] ? P_AWAY[mi] : (P_AWAY_FROM[mi] >= 0 ? W[P_AWAY_FROM[mi]] : -1);
    const r = P_RESULT[mi];
    W[mi] = r === 1 ? home : r === 2 ? away : -1;
  }
  RO16_MEM.fill(0); for (let mi = 0;  mi < 16; mi++) if (W[mi] >= 0) RO16_MEM[W[mi]] = 1;
  QF_MEM.fill(0);   for (let mi = 16; mi < 24; mi++) if (W[mi] >= 0) QF_MEM[W[mi]]   = 1;
  SF_MEM.fill(0);   for (let mi = 24; mi < 28; mi++) if (W[mi] >= 0) SF_MEM[W[mi]]   = 1;
  FINAL_MEM.fill(0);for (let mi = 28; mi < 30; mi++) if (W[mi] >= 0) FINAL_MEM[W[mi]]= 1;
  const champ = W[30];
  const scores = new Array(NP);
  for (let pi = 0; pi < NP; pi++) {
    const base = pi * 31;
    let pts = 0;
    for (let i = 0;  i < 16; i++) { const t = PRED_DATA[base+i];    if (t>=0 && RO16_MEM[t])  pts+=1; }
    for (let i = 16; i < 24; i++) { const t = PRED_DATA[base+i];    if (t>=0 && QF_MEM[t])    pts+=2; }
    for (let i = 24; i < 28; i++) { const t = PRED_DATA[base+i];    if (t>=0 && SF_MEM[t])    pts+=3; }
    for (let i = 28; i < 30; i++) { const t = PRED_DATA[base+i];    if (t>=0 && FINAL_MEM[t]) pts+=5; }
    if (champ >= 0 && PRED_DATA[base+30] === champ)                                            pts+=8;
    scores[pi] = pts;
  }
  return scores;
}

const currentScores = currentScoreFromBuffers();
const currentTop    = Math.max(...currentScores);

// ── Simulation ─────────────────────────────────────────────
const N = 1_000_000;
const peakPoss = [...currentScores];
const sumPts   = new Float64Array(NP);

console.log(`Running ${N.toLocaleString()} simulations  (${NUM_UNPLAYED} unplayed matches)...`);
const t0 = Date.now();

for (let sim = 0; sim < N; sim++) {

  // 1. Random outcomes for unplayed matches
  for (let j = 0; j < NUM_UNPLAYED; j++) RNG[j] = Math.random() < 0.5 ? 1 : 2;

  // 2. Resolve bracket (all integer ops, no heap alloc)
  for (let mi = 0; mi < M; mi++) {
    const home = P_IS_RO32[mi] ? P_HOME[mi] : (P_HOME_FROM[mi] >= 0 ? W[P_HOME_FROM[mi]] : -1);
    const away = P_IS_RO32[mi] ? P_AWAY[mi] : (P_AWAY_FROM[mi] >= 0 ? W[P_AWAY_FROM[mi]] : -1);
    const slot = P_RNGSLOT[mi];
    const r    = slot < 0 ? P_RESULT[mi] : RNG[slot];
    W[mi] = r === 1 ? home : r === 2 ? away : -1;
  }

  // 3. Build stage membership (clear + fill, 32 bytes each)
  RO16_MEM.fill(0); for (let mi = 0;  mi < 16; mi++) if (W[mi] >= 0) RO16_MEM[W[mi]] = 1;
  QF_MEM.fill(0);   for (let mi = 16; mi < 24; mi++) if (W[mi] >= 0) QF_MEM[W[mi]]   = 1;
  SF_MEM.fill(0);   for (let mi = 24; mi < 28; mi++) if (W[mi] >= 0) SF_MEM[W[mi]]   = 1;
  FINAL_MEM.fill(0);for (let mi = 28; mi < 30; mi++) if (W[mi] >= 0) FINAL_MEM[W[mi]]= 1;
  const champ = W[30];

  // 4. Score each participant
  for (let pi = 0; pi < NP; pi++) {
    const base = pi * 31;
    let pts = 0;
    for (let i = 0;  i < 16; i++) { const t = PRED_DATA[base+i];    if (t>=0 && RO16_MEM[t])  pts+=1; }
    for (let i = 16; i < 24; i++) { const t = PRED_DATA[base+i];    if (t>=0 && QF_MEM[t])    pts+=2; }
    for (let i = 24; i < 28; i++) { const t = PRED_DATA[base+i];    if (t>=0 && SF_MEM[t])    pts+=3; }
    for (let i = 28; i < 30; i++) { const t = PRED_DATA[base+i];    if (t>=0 && FINAL_MEM[t]) pts+=5; }
    if (champ >= 0 && PRED_DATA[base+30] === champ)                                            pts+=8;
    if (pts > peakPoss[pi]) peakPoss[pi] = pts;
    sumPts[pi] += pts;
  }
}

const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`Done in ${elapsed}s\n`);

// ── Output ─────────────────────────────────────────────────
const out = {
  _generated:     new Date().toISOString(),
  _numSims:       N,
  _matchesPlayed: MATCH_IDS.filter(id => results[id] != null).length,
  currentTopScore: currentTop,
  participants:   {}
};

for (let pi = 0; pi < NP; pi++) {
  const name = PARTICIPANTS[pi];
  out.participants[name] = {
    currentScore: currentScores[pi],
    peakPoss:     peakPoss[pi],
    avgPts:       Math.round(sumPts[pi] / N * 10) / 10,
    eliminated:   peakPoss[pi] < currentTop
  };
}

fs.writeFileSync(path.join(dir, 'sim_results.json'), JSON.stringify(out, null, 2));
console.log(`Written → kupatakip/sim_results.json\n`);
console.log(`Current top score: ${currentTop}\n`);

const sorted = [...PARTICIPANTS].sort((a, b) =>
  out.participants[b].peakPoss - out.participants[a].peakPoss ||
  out.participants[b].avgPts   - out.participants[a].avgPts
);
console.log('Name                       Cur  Peak  Avg   Status');
console.log('─'.repeat(55));
for (const name of sorted) {
  const d = out.participants[name];
  console.log(
    name.padEnd(27) +
    String(d.currentScore).padEnd(5) +
    String(d.peakPoss).padEnd(6) +
    String(d.avgPts).padEnd(6) +
    (d.eliminated ? 'ELIMINATED' : '')
  );
}
