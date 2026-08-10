/**
 * Copies Mert's supplied club crests and the irishtable logo out of
 * docs/pl-fork/assets/ into public/, under clean, slugged filenames that
 * match src/data/clubs.ts's `crest` paths.
 *
 * Modelled on the parent project's scripts/import-club-badges.mjs — a real
 * source→processed pair, so the raw sourced files stay untouched and
 * re-runnable rather than being hand-edited in place.
 *
 * Processing is deliberately conservative: strip <metadata> blocks and XML
 * comments (footy-logos.cc embeds a tracking hash and a source URL in every
 * file), collapse redundant whitespace, and guarantee a viewBox so the crest
 * scales cleanly in a flex row. No path rewriting — these are real club
 * badges and mangling their geometry to save bytes is not worth the risk.
 *
 * Run: npm run crests
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, "..", "..", "docs", "pl-fork", "assets");
const CREST_OUT = join(here, "..", "public", "crests");
const BRAND_OUT = join(here, "..", "public", "brand");

/** Source filename (as supplied) → the club id used everywhere in the app. */
const CREST_MAP = {
  "afc-bournemouth-logo-footylogos.svg": "bournemouth",
  "arsenal-logo-footylogos.svg": "arsenal",
  "aston-villa-logo-footylogos.svg": "aston-villa",
  "brentford-logo-footylogos.svg": "brentford",
  "brighton-and-hove-albion-logo-footylogos.svg": "brighton",
  "chelsea-logo-footylogos.svg": "chelsea",
  "coventry-city-logo-footylogos.svg": "coventry",
  "crystal-palace-logo-footylogos.svg": "crystal-palace",
  "everton-logo-footylogos.svg": "everton",
  "fulham-logo-footylogos.svg": "fulham",
  "hull-city-logo-footylogos.svg": "hull",
  "ipswich-town-logo-footylogos.svg": "ipswich",
  "leeds-united-logo-footylogos.svg": "leeds",
  "liverpool-fc-logo-footylogos.svg": "liverpool",
  "manchester-city-logo-footylogos.svg": "man-city",
  "manchester-united-logo-footylogos.svg": "man-united",
  "newcastle-united-logo-footylogos.svg": "newcastle",
  "nottingham-forest-logo-footylogos.svg": "nottingham-forest",
  "sunderland-logo-footylogos.svg": "sunderland",
  "tottenham-hotspur-logo-footylogos.svg": "tottenham",
};

const BRAND_MAP = {
  "irishtable-logo.svg": "vizehtable-logo.svg",
};

function clean(svg) {
  let out = svg
    .replace(/<metadata[\s\S]*?<\/metadata>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+xmlns:fl="[^"]*"/g, "")
    .replace(/\s+data-source="[^"]*"/g, "")
    .replace(/>\s+</g, "><")
    .trim();

  // Guarantee a viewBox. A few of the supplied files carry width/height only;
  // without a viewBox they refuse to scale down inside a sized container.
  if (!/viewBox=/i.test(out)) {
    const w = out.match(/\swidth="([\d.]+)"/i);
    const h = out.match(/\sheight="([\d.]+)"/i);
    if (w && h) {
      out = out.replace(/<svg/i, `<svg viewBox="0 0 ${w[1]} ${h[1]}"`);
    }
  }

  // Drop fixed pixel dimensions so CSS sizing always wins. The viewBox
  // guaranteed above is what preserves the aspect ratio.
  out = out.replace(/(<svg[^>]*?)\swidth="[^"]*"/i, "$1").replace(/(<svg[^>]*?)\sheight="[^"]*"/i, "$1");

  return out;
}

function run() {
  if (!existsSync(SRC)) {
    console.error(`Source directory missing: ${SRC}`);
    process.exit(1);
  }
  mkdirSync(CREST_OUT, { recursive: true });
  mkdirSync(BRAND_OUT, { recursive: true });

  const present = new Set(readdirSync(SRC));
  let bytesBefore = 0;
  let bytesAfter = 0;
  const missing = [];

  for (const [file, id] of Object.entries(CREST_MAP)) {
    if (!present.has(file)) {
      missing.push(file);
      continue;
    }
    const raw = readFileSync(join(SRC, file), "utf8");
    const cleaned = clean(raw);
    bytesBefore += Buffer.byteLength(raw);
    bytesAfter += Buffer.byteLength(cleaned);
    writeFileSync(join(CREST_OUT, `${id}.svg`), cleaned, "utf8");
  }

  for (const [file, outName] of Object.entries(BRAND_MAP)) {
    if (!present.has(file)) {
      missing.push(file);
      continue;
    }
    writeFileSync(join(BRAND_OUT, outName), clean(readFileSync(join(SRC, file), "utf8")), "utf8");
  }

  const kb = (n) => `${(n / 1024).toFixed(1)} KiB`;
  console.log(
    `Wrote ${Object.keys(CREST_MAP).length - missing.length} crests — ${kb(bytesBefore)} → ${kb(bytesAfter)}`
  );
  if (missing.length) {
    console.error(`\nMissing ${missing.length} source file(s):`);
    for (const m of missing) console.error(`  - ${m}`);
    process.exit(1);
  }
}

run();
