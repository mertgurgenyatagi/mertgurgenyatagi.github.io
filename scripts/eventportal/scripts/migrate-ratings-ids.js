// One-time cutover script, NOT part of the ongoing pipeline: ratings.csv's
// `id` column was synthesized under the old per-showtime scheme
// (source + native session key/link). The new canonical id is a hash of
// normalized title+venue instead -- a structurally different input, so none
// of the existing rated rows' ids would ever match a canonical id computed
// by the new pipeline. This recomputes `id` for every row in place from the
// row's own title/venue columns (which the CSV already carries), so the
// human ground-truth dataset keeps working after cutover.
//
// Run once by hand: node scripts/migrate-ratings-ids.js
const fs = require('fs');
const path = require('path');
const { canonicalId, canonicalKey } = require('../lib/canonical');

const RATINGS_CSV = path.join(__dirname, '..', 'data', 'ratings.csv');

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else if (c === '"') { inQuotes = true; }
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\r') { /* skip */ }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function csvEscape(value) {
  return '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"';
}

function main() {
  const raw = fs.readFileSync(RATINGS_CSV, 'utf8');
  const hasBom = raw.charCodeAt(0) === 0xfeff;
  const rows = parseCsv(raw.replace(/^﻿/, ''));
  const header = rows[0];
  const idIdx = header.indexOf('id');
  const titleIdx = header.indexOf('title');
  const venueIdx = header.indexOf('venue');
  if (idIdx === -1 || titleIdx === -1 || venueIdx === -1) {
    throw new Error('ratings.csv is missing id/title/venue columns');
  }

  let migrated = 0;
  const outRows = [header];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    if (cells.length === 1 && cells[0] === '') continue;
    const oldId = cells[idIdx];
    const newId = canonicalId(canonicalKey(cells[titleIdx], cells[venueIdx]));
    cells[idIdx] = newId;
    if (newId !== oldId) migrated++;
    outRows.push(cells);
  }

  const outText = outRows.map(r => r.map(csvEscape).join(',')).join('\r\n') + '\r\n';
  fs.writeFileSync(RATINGS_CSV, (hasBom ? '﻿' : '') + outText);
  console.log(`[migrate-ratings-ids] rewrote ${outRows.length - 1} rows, ${migrated} ids changed`);
}

main();
