/**
 * The 20 Premier League clubs for 2026-27.
 *
 * This roster is authoritative: Mert supplied both the club list and the
 * matching crest SVGs directly (docs/pl-fork/assets/). Unlike the parent
 * project — where crests are deliberately hash-assigned to the *wrong* clubs
 * pending a roster swap — every crest here belongs to its real club.
 *
 * `crest` paths point at public/crests/, populated by scripts/import-crests.mjs.
 * A test asserts every club has a crest file and that ids/codes are unique.
 */

export type ClubId =
  | "arsenal"
  | "aston-villa"
  | "bournemouth"
  | "brentford"
  | "brighton"
  | "chelsea"
  | "coventry"
  | "crystal-palace"
  | "everton"
  | "fulham"
  | "hull"
  | "ipswich"
  | "leeds"
  | "liverpool"
  | "man-city"
  | "man-united"
  | "newcastle"
  | "nottingham-forest"
  | "sunderland"
  | "tottenham";

export type Club = {
  id: ClubId;
  /** Full name, as it appears in a table or a headline. */
  name: string;
  /** Compact name for tight columns and mobile rows. */
  shortName: string;
  /** Three-letter code, for the very tightest slots (award picker rows). */
  code: string;
  /** Path under public/, written by the crest import script. */
  crest: string;
};

/**
 * Alphabetical by `name` — the order the ranker seeds with, so nobody's
 * starting position flatters a particular club. AFC Bournemouth sorts first
 * on "AFC", which is also how the Premier League's own club list orders it.
 */
export const CLUBS: readonly Club[] = [
  { id: "bournemouth", name: "AFC Bournemouth", shortName: "Bournemouth", code: "BOU", crest: "/crests/bournemouth.svg" },
  { id: "arsenal", name: "Arsenal", shortName: "Arsenal", code: "ARS", crest: "/crests/arsenal.svg" },
  { id: "aston-villa", name: "Aston Villa", shortName: "Villa", code: "AVL", crest: "/crests/aston-villa.svg" },
  { id: "brentford", name: "Brentford", shortName: "Brentford", code: "BRE", crest: "/crests/brentford.svg" },
  { id: "brighton", name: "Brighton & Hove Albion", shortName: "Brighton", code: "BHA", crest: "/crests/brighton.svg" },
  { id: "chelsea", name: "Chelsea", shortName: "Chelsea", code: "CHE", crest: "/crests/chelsea.svg" },
  { id: "coventry", name: "Coventry City", shortName: "Coventry", code: "COV", crest: "/crests/coventry.svg" },
  { id: "crystal-palace", name: "Crystal Palace", shortName: "Palace", code: "CRY", crest: "/crests/crystal-palace.svg" },
  { id: "everton", name: "Everton", shortName: "Everton", code: "EVE", crest: "/crests/everton.svg" },
  { id: "fulham", name: "Fulham", shortName: "Fulham", code: "FUL", crest: "/crests/fulham.svg" },
  { id: "hull", name: "Hull City", shortName: "Hull", code: "HUL", crest: "/crests/hull.svg" },
  { id: "ipswich", name: "Ipswich Town", shortName: "Ipswich", code: "IPS", crest: "/crests/ipswich.svg" },
  { id: "leeds", name: "Leeds United", shortName: "Leeds", code: "LEE", crest: "/crests/leeds.svg" },
  { id: "liverpool", name: "Liverpool", shortName: "Liverpool", code: "LIV", crest: "/crests/liverpool.svg" },
  { id: "man-city", name: "Manchester City", shortName: "Man City", code: "MCI", crest: "/crests/man-city.svg" },
  { id: "man-united", name: "Manchester United", shortName: "Man United", code: "MUN", crest: "/crests/man-united.svg" },
  { id: "newcastle", name: "Newcastle United", shortName: "Newcastle", code: "NEW", crest: "/crests/newcastle.svg" },
  { id: "nottingham-forest", name: "Nottingham Forest", shortName: "Forest", code: "NFO", crest: "/crests/nottingham-forest.svg" },
  { id: "sunderland", name: "Sunderland", shortName: "Sunderland", code: "SUN", crest: "/crests/sunderland.svg" },
  { id: "tottenham", name: "Tottenham Hotspur", shortName: "Spurs", code: "TOT", crest: "/crests/tottenham.svg" },
];

export const CLUB_COUNT = CLUBS.length;

const CLUB_BY_ID = new Map<string, Club>(CLUBS.map((c) => [c.id, c]));

export function getClub(id: string): Club | undefined {
  return CLUB_BY_ID.get(id);
}

/** Club name for display, falling back to the raw id so a stale stored
 *  prediction renders as *something* rather than blank. */
export function clubName(id: string): string {
  return CLUB_BY_ID.get(id)?.name ?? id;
}

export const CLUB_IDS: readonly string[] = CLUBS.map((c) => c.id);

export function isClubId(value: unknown): value is ClubId {
  return typeof value === "string" && CLUB_BY_ID.has(value);
}
