#!/usr/bin/env node
'use strict';

const fs   = require('fs');
const path = require('path');
const dir  = path.join(__dirname, 'kupatakip');

// Load data.js
const dataJs = fs.readFileSync(path.join(dir, 'data.js'), 'utf8');
const { TR_TO_EN, BRACKET, PREDICTIONS, PARTICIPANTS } = new Function(
  dataJs + '\nreturn { TR_TO_EN, BRACKET, PREDICTIONS, PARTICIPANTS };'
)();

// Load results
const results = JSON.parse(fs.readFileSync(path.join(dir, 'results.json'), 'utf8'));
delete results._comment;

// Match order — match_31 is the Final
const MATCH_ORDER = [
  'match_1','match_2','match_3','match_4','match_5','match_6','match_7','match_8',
  'match_9','match_10','match_11','match_12','match_13','match_14','match_15','match_16',
  'match_17','match_18','match_19','match_20','match_21','match_22','match_23','match_24',
  'match_25','match_26','match_27','match_28',
  'match_29','match_30',
  'match_31'
];

// Resolve winners for all completed matches
const winners = {};
function resolveMatch(id) {
  if (id in winners) return;
  const m = BRACKET[id];
  if (!m) return;
  if (m.homeFrom) resolveMatch(m.homeFrom);
  if (m.awayFrom) resolveMatch(m.awayFrom);

  let home, away;
  if (m.round === 'RO32') {
    home = m.home;
    away = m.away;
  } else {
    home = m.homeFrom ? (winners[m.homeFrom] ?? null) : null;
    away = m.awayFrom ? (winners[m.awayFrom] ?? null) : null;
  }

  const r = results[id];
  winners[id] = r === 1 ? home : r === 2 ? away : null;
}
MATCH_ORDER.forEach(resolveMatch);

// Which prediction array to check for each round's winner
const PRED_KEY = {
  RO32:  'ro16',
  RO16:  'qf',
  QF:    'sf',
  SF:    'final',
  Final: 'champion'
};

// Did participant correctly predict the winner advancing from this match?
function didPredict(name, id) {
  const winner = winners[id];
  if (!winner) return null;

  const round = BRACKET[id].round;
  const key   = PRED_KEY[round];
  if (!key) return null;

  const pred     = PREDICTIONS[name];
  const winnerTR = Object.entries(TR_TO_EN).find(([, en]) => en === winner)?.[0];
  if (!winnerTR) return null;

  return key === 'champion'
    ? pred.champion === winnerTR
    : pred[key].includes(winnerTR);
}

// Last 5 completed matches sorted chronologically (oldest → newest)
const completed = MATCH_ORDER
  .filter(id => results[id] != null)
  .sort((a, b) => new Date(BRACKET[a].datetime) - new Date(BRACKET[b].datetime));
const last5 = completed.slice(-5);
const offset    = 5 - last5.length; // empty circles go on the left

// Build form data
const participantForm = {};
PARTICIPANTS.forEach(name => {
  const circles = [null, null, null, null, null];
  last5.forEach((id, i) => { circles[offset + i] = didPredict(name, id); });
  participantForm[name] = circles;
});

const slotMatches = [null, null, null, null, null];
last5.forEach((id, i) => { slotMatches[offset + i] = id; });

const out = {
  _generated:  new Date().toISOString(),
  _matchCount: completed.length,
  slotMatches,
  participants: participantForm
};

fs.writeFileSync(path.join(dir, 'form.json'), JSON.stringify(out, null, 2));
console.log('Written → kupatakip/form.json');
console.log('Recent matches:', last5.join(', ') || '(none yet)');
console.log('');

const ICONS = v => v === null ? 'o' : v ? 'Y' : 'N';
console.log('Name'.padEnd(25) + ' [1][2][3][4][5]');
console.log('-'.repeat(42));
PARTICIPANTS.forEach(name => {
  const row = participantForm[name].map(ICONS).join(' ');
  console.log(name.padEnd(25) + '  ' + row);
});
