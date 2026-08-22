// Copies data/player_data.csv -- the source of truth -- to public/player_data.csv,
// the copy the running app actually fetches. Run automatically before `dev` and
// `build` (see package.json's predev/prebuild) so the two can never drift apart by
// hand-editing only one of them.
//
// Usage: node scripts/sync_player_data.mjs

import { copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const source = path.join(ROOT, 'data', 'player_data.csv')
const destination = path.join(ROOT, 'public', 'player_data.csv')

copyFileSync(source, destination)
console.log(`Synced ${path.relative(ROOT, source)} -> ${path.relative(ROOT, destination)}`)
