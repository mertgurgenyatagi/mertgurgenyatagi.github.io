/**
 * The eight non-table predictions: two cup winners and six individual awards.
 *
 * Every shortlist is *derived* from clubs.ts / people.ts rather than hand-
 * listed, so correcting a squad in one place fixes every picker at once. Each
 * award exposes a uniform `Candidate[]`, which is what lets one picker
 * component render all eight steps.
 *
 * Point values live in scoring.ts and are re-exported onto each award here, so
 * the prediction flow and the Scoring page cannot disagree about what a pick
 * is worth.
 */

import { CLUBS, type Club } from "./clubs";
import { MANAGERS, PLAYERS, SEASON_START_YEAR, type Player } from "./people";
import { AWARD_POINTS } from "./scoring";

export type AwardId =
  | "faCup"
  | "carabao"
  | "playerOfSeason"
  | "youngPlayerOfSeason"
  | "managerOfSeason"
  | "goldenBoot"
  | "goldenGlove"
  | "bestPlaymaker";

/** What a picker row renders. Uniform across clubs, players and managers. */
export type Candidate = {
  id: string;
  name: string;
  /** Club name for a player/manager; nothing for a club itself. */
  subtitle?: string;
  /** Crest to show alongside — the club's own, or the person's club. */
  crest?: string;
};

export type Award = {
  id: AwardId;
  label: string;
  /** One line explaining what is actually being predicted. */
  blurb: string;
  points: number;
  /** Plural noun for the picker's search box — "Search players…". Kept
   *  explicit because lowercasing the label mangles acronyms ("fa cup"). */
  searchNoun: string;
  candidates: readonly Candidate[];
};

/** Young Player of the Season follows the Premier League's U23 convention:
 *  eligible if 23 or younger at the start of the season. */
export const YOUNG_PLAYER_MAX_AGE = 23;

function isYoung(p: Player): boolean {
  return SEASON_START_YEAR - p.bornYear <= YOUNG_PLAYER_MAX_AGE;
}

const CLUB_BY_ID = new Map<string, Club>(CLUBS.map((c) => [c.id, c]));

function clubCandidate(club: Club): Candidate {
  return { id: club.id, name: club.name, crest: club.crest };
}

function playerCandidate(p: Player): Candidate {
  const club = CLUB_BY_ID.get(p.clubId);
  return { id: p.id, name: p.name, subtitle: club?.shortName, crest: club?.crest };
}

/** Alphabetical by display name — no implied ranking or favouritism in the
 *  order a shortlist is presented in. */
function byName(a: Candidate, b: Candidate): number {
  return a.name.localeCompare(b.name);
}

const CLUB_CANDIDATES: readonly Candidate[] = CLUBS.map(clubCandidate);

const ALL_PLAYERS: readonly Candidate[] = PLAYERS.map(playerCandidate).sort(byName);

const YOUNG_PLAYERS: readonly Candidate[] = PLAYERS.filter(isYoung)
  .map(playerCandidate)
  .sort(byName);

const KEEPERS: readonly Candidate[] = PLAYERS.filter((p) => p.position === "GK")
  .map(playerCandidate)
  .sort(byName);

/** Golden Boot and Best Playmaker both draw from everyone who plausibly
 *  scores or creates — defenders and keepers are excluded rather than
 *  cluttering a list nobody will pick them from. */
const ATTACKERS: readonly Candidate[] = PLAYERS.filter(
  (p) => p.position === "FW" || p.position === "MF"
)
  .map(playerCandidate)
  .sort(byName);

const MANAGER_CANDIDATES: readonly Candidate[] = MANAGERS.map((m) => {
  const club = CLUB_BY_ID.get(m.clubId);
  return { id: m.id, name: m.name, subtitle: club?.shortName, crest: club?.crest };
}).sort(byName);

/**
 * Order matters — this is the exact order the prediction flow walks through
 * after the table and before the review step.
 */
export const AWARDS: readonly Award[] = [
  {
    id: "faCup",
    label: "FA Cup Winner",
    blurb: "Who lifts the FA Cup. Only Premier League clubs are listed here.",
    points: AWARD_POINTS.faCup,
    searchNoun: "clubs",
    candidates: CLUB_CANDIDATES,
  },
  {
    id: "carabao",
    label: "Carabao Cup Winner",
    blurb: "Who lifts the League Cup. Only Premier League clubs are listed here.",
    points: AWARD_POINTS.carabao,
    searchNoun: "clubs",
    candidates: CLUB_CANDIDATES,
  },
  {
    id: "playerOfSeason",
    label: "Player of the Season",
    blurb: "The season's outstanding player, whoever takes the official award.",
    points: AWARD_POINTS.playerOfSeason,
    searchNoun: "players",
    candidates: ALL_PLAYERS,
  },
  {
    id: "youngPlayerOfSeason",
    label: "Young Player of the Season",
    blurb: `Aged ${YOUNG_PLAYER_MAX_AGE} or under at the start of the season.`,
    points: AWARD_POINTS.youngPlayerOfSeason,
    searchNoun: "players",
    candidates: YOUNG_PLAYERS,
  },
  {
    id: "managerOfSeason",
    label: "Manager of the Season",
    blurb: "One per club. Sacked mid-season? You still keep the pick.",
    points: AWARD_POINTS.managerOfSeason,
    searchNoun: "managers",
    candidates: MANAGER_CANDIDATES,
  },
  {
    id: "goldenBoot",
    label: "Golden Boot",
    blurb: "Most league goals across the season.",
    points: AWARD_POINTS.goldenBoot,
    searchNoun: "players",
    candidates: ATTACKERS,
  },
  {
    id: "goldenGlove",
    label: "Golden Glove",
    blurb: "Most clean sheets across the season.",
    points: AWARD_POINTS.goldenGlove,
    searchNoun: "goalkeepers",
    candidates: KEEPERS,
  },
  {
    id: "bestPlaymaker",
    label: "Best Playmaker",
    blurb: "Most league assists across the season.",
    points: AWARD_POINTS.bestPlaymaker,
    searchNoun: "players",
    candidates: ATTACKERS,
  },
];

export const AWARD_IDS: readonly AwardId[] = AWARDS.map((a) => a.id);

const AWARD_BY_ID = new Map<string, Award>(AWARDS.map((a) => [a.id, a]));

export function getAward(id: string): Award | undefined {
  return AWARD_BY_ID.get(id);
}

/** Resolve any award pick to a display name, regardless of which pool it
 *  came from. Falls back to the stored id so nothing renders blank. */
export function candidateName(awardId: AwardId, candidateId: string): string {
  const award = AWARD_BY_ID.get(awardId);
  return award?.candidates.find((c) => c.id === candidateId)?.name ?? candidateId;
}

/** Case- and accent-insensitive search within one award's shortlist. */
export function searchCandidates(
  award: Award,
  query: string
): readonly Candidate[] {
  const q = normalize(query.trim());
  if (!q) return award.candidates;
  return award.candidates.filter(
    (c) => normalize(c.name).includes(q) || normalize(c.subtitle ?? "").includes(q)
  );
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
