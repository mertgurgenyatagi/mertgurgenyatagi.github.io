#!/usr/bin/env node
'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');
const { execSync } = require('child_process');

const API_KEY = process.env.FD_API_KEY;
if (!API_KEY) { console.error('FD_API_KEY not set'); process.exit(1); }

const root = path.join(__dirname, '..');
const dir  = path.join(root, 'kupatakip');

// Load BRACKET from data.js
const dataJs = fs.readFileSync(path.join(dir, 'data.js'), 'utf8');
const { BRACKET } = new Function(dataJs + '\nreturn { BRACKET };')();

// Load current results
const results = JSON.parse(fs.readFileSync(path.join(dir, 'results.json'), 'utf8'));

// football-data.org team name → our EN names
const NORMALIZE = {
  "USA":                          "United States",
  "Côte d'Ivoire":                "Ivory Coast",
  "Bosnia-Herzegovina":           "Bosnia and Herzegovina",
  "Congo DR":                     "DR Congo",
  "Democratic Republic of Congo": "DR Congo",
  "Cabo Verde":                   "Cape Verde",
};
function normalize(name) { return NORMALIZE[name] || name; }

const MATCH_ORDER = Array.from({ length: 31 }, (_, i) => `match_${i + 1}`);

// Resolve actual bracket teams + winners from stored results
const actualTeams   = {};
const actualWinners = {};

function resolveActual(id) {
  if (id in actualWinners) return;
  const m = BRACKET[id];
  if (m.homeFrom) resolveActual(m.homeFrom);
  if (m.awayFrom) resolveActual(m.awayFrom);

  const home = m.round === 'RO32' ? m.home : (actualWinners[m.homeFrom] ?? null);
  const away = m.round === 'RO32' ? m.away : (actualWinners[m.awayFrom] ?? null);
  actualTeams[id] = { home, away };

  const r = results[id];
  actualWinners[id] = r === 1 ? home : r === 2 ? away : null;
}
MATCH_ORDER.forEach(resolveActual);

// Matches past kickoff + 3.5h with no result yet
const now = Date.now();
const pending = MATCH_ORDER.filter(id => {
  if (results[id] != null) return false;
  return now > new Date(BRACKET[id].datetime).getTime() + 2 * 3600 * 1000;
});

if (pending.length === 0) {
  console.log('No pending matches.');
  process.exit(0);
}
console.log('Pending:', pending.join(', '));

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'X-Auth-Token': API_KEY } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { reject(new Error(`Parse error: ${data.slice(0, 300)}`)); }
      });
    }).on('error', reject);
  });
}

async function main() {
  const url = 'https://api.football-data.org/v4/competitions/WC/matches?season=2026&status=FINISHED';
  console.log('GET', url);

  const { status, body } = await fetchJson(url);
  if (status !== 200 || !body.matches) {
    console.error(`API error (HTTP ${status}):`, JSON.stringify(body).slice(0, 500));
    process.exit(1);
  }
  console.log(`${body.matches.length} finished matches from API`);

  // Build lookup: "HomeEN|AwayEN" → 1 (home wins) | 2 (away wins)
  const apiLookup = {};
  for (const m of body.matches) {
    const home = normalize(m.homeTeam.name);
    const away = normalize(m.awayTeam.name);
    let result;
    // score.winner reflects the actual advancing team (including ET/PKs)
    if      (m.score.winner === 'HOME_TEAM') result = 1;
    else if (m.score.winner === 'AWAY_TEAM') result = 2;
    else {
      // fallback to full-time goals
      const hs = m.score.fullTime.home, as = m.score.fullTime.away;
      if (hs != null && as != null && hs !== as) result = hs > as ? 1 : 2;
      else continue;
    }
    apiLookup[`${home}|${away}`] = result;
  }

  let changed = 0;
  for (const id of pending) {
    const { home, away } = actualTeams[id];
    if (!home || !away) {
      console.log(`${id}: teams not resolved yet (upstream match unfinished)`);
      continue;
    }
    const r = apiLookup[`${home}|${away}`];
    if (r == null) {
      console.log(`${id}: "${home} vs ${away}" not in API yet`);
      continue;
    }
    console.log(`${id}: ${home} vs ${away} → ${r === 1 ? home : away} wins (${r})`);
    results[id] = r;
    changed++;
  }

  if (changed === 0) {
    console.log('No new results to write.');
    process.exit(0);
  }

  fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify(results, null, 2));
  console.log(`results.json updated (${changed} change(s))`);

  execSync('node form.js', { cwd: root, stdio: 'inherit' });
}

main().catch(e => { console.error(e.message); process.exit(1); });
