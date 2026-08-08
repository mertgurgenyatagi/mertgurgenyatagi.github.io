/**
 * ⚠️ REVIEW REQUIRED BEFORE LAUNCH ⚠️
 *
 * The player and manager pool behind the six individual-award shortlists.
 *
 * This data is drafted, not verified. It is assembled from squads as they
 * stood before the 2026-27 season and WILL contain players who have since
 * transferred, retired, or been relegated out of the league, and managers who
 * have since been replaced. Three newly-promoted clubs (Coventry, Hull,
 * Ipswich) have explicit placeholder entries because no reliable squad data
 * was available at the time of writing.
 *
 * Nothing downstream breaks if an entry is wrong — ids are opaque and the
 * shortlists derive mechanically — so this file can be corrected wholesale
 * without touching a single component. Search for PLACEHOLDER to find the
 * entries that are definitely not real.
 *
 * `bornYear` exists only to derive Young Player of the Season eligibility
 * (see awards.ts). It is approximate for several entries.
 */

import type { ClubId } from "./clubs";

export type Position = "GK" | "DF" | "MF" | "FW";

export type Player = {
  id: string;
  name: string;
  clubId: ClubId;
  position: Position;
  bornYear: number;
};

export type Manager = {
  id: string;
  name: string;
  clubId: ClubId;
};

/** The season this pool describes — drives the U23 cutoff. */
export const SEASON_START_YEAR = 2026;

export const PLAYERS: readonly Player[] = [
  // Arsenal
  { id: "raya", name: "David Raya", clubId: "arsenal", position: "GK", bornYear: 1995 },
  { id: "saka", name: "Bukayo Saka", clubId: "arsenal", position: "FW", bornYear: 2001 },
  { id: "odegaard", name: "Martin Ødegaard", clubId: "arsenal", position: "MF", bornYear: 1998 },
  { id: "rice", name: "Declan Rice", clubId: "arsenal", position: "MF", bornYear: 1999 },
  { id: "martinelli", name: "Gabriel Martinelli", clubId: "arsenal", position: "FW", bornYear: 2001 },
  { id: "saliba", name: "William Saliba", clubId: "arsenal", position: "DF", bornYear: 2001 },

  // Aston Villa
  { id: "e-martinez", name: "Emiliano Martínez", clubId: "aston-villa", position: "GK", bornYear: 1992 },
  { id: "watkins", name: "Ollie Watkins", clubId: "aston-villa", position: "FW", bornYear: 1995 },
  { id: "rogers", name: "Morgan Rogers", clubId: "aston-villa", position: "MF", bornYear: 2002 },
  { id: "mcginn", name: "John McGinn", clubId: "aston-villa", position: "MF", bornYear: 1994 },

  // Bournemouth
  { id: "petrovic", name: "Đorđe Petrović", clubId: "bournemouth", position: "GK", bornYear: 1999 },
  { id: "semenyo", name: "Antoine Semenyo", clubId: "bournemouth", position: "FW", bornYear: 2000 },
  { id: "kluivert", name: "Justin Kluivert", clubId: "bournemouth", position: "FW", bornYear: 1999 },
  { id: "tavernier", name: "Marcus Tavernier", clubId: "bournemouth", position: "MF", bornYear: 1999 },

  // Brentford
  { id: "kelleher", name: "Caoimhín Kelleher", clubId: "brentford", position: "GK", bornYear: 1998 },
  { id: "wissa", name: "Yoane Wissa", clubId: "brentford", position: "FW", bornYear: 1996 },
  { id: "damsgaard", name: "Mikkel Damsgaard", clubId: "brentford", position: "MF", bornYear: 2000 },
  { id: "schade", name: "Kevin Schade", clubId: "brentford", position: "FW", bornYear: 2001 },

  // Brighton
  { id: "verbruggen", name: "Bart Verbruggen", clubId: "brighton", position: "GK", bornYear: 2002 },
  { id: "mitoma", name: "Kaoru Mitoma", clubId: "brighton", position: "FW", bornYear: 1997 },
  { id: "baleba", name: "Carlos Baleba", clubId: "brighton", position: "MF", bornYear: 2004 },
  { id: "rutter", name: "Georginio Rutter", clubId: "brighton", position: "FW", bornYear: 2002 },

  // Chelsea
  { id: "r-sanchez", name: "Robert Sánchez", clubId: "chelsea", position: "GK", bornYear: 1997 },
  { id: "palmer", name: "Cole Palmer", clubId: "chelsea", position: "MF", bornYear: 2002 },
  { id: "delap", name: "Liam Delap", clubId: "chelsea", position: "FW", bornYear: 2003 },
  { id: "enzo", name: "Enzo Fernández", clubId: "chelsea", position: "MF", bornYear: 2001 },
  { id: "caicedo", name: "Moisés Caicedo", clubId: "chelsea", position: "MF", bornYear: 2001 },
  { id: "colwill", name: "Levi Colwill", clubId: "chelsea", position: "DF", bornYear: 2003 },
  { id: "joao-pedro", name: "João Pedro", clubId: "chelsea", position: "FW", bornYear: 2001 },

  // Coventry City — PLACEHOLDER, newly promoted, squad not verified
  { id: "cov-gk", name: "Coventry goalkeeper (PLACEHOLDER)", clubId: "coventry", position: "GK", bornYear: 1995 },
  { id: "cov-fw", name: "Coventry forward (PLACEHOLDER)", clubId: "coventry", position: "FW", bornYear: 1998 },
  { id: "cov-mf", name: "Coventry midfielder (PLACEHOLDER)", clubId: "coventry", position: "MF", bornYear: 2000 },

  // Crystal Palace
  { id: "henderson", name: "Dean Henderson", clubId: "crystal-palace", position: "GK", bornYear: 1997 },
  { id: "eze", name: "Eberechi Eze", clubId: "crystal-palace", position: "MF", bornYear: 1998 },
  { id: "mateta", name: "Jean-Philippe Mateta", clubId: "crystal-palace", position: "FW", bornYear: 1997 },
  { id: "wharton", name: "Adam Wharton", clubId: "crystal-palace", position: "MF", bornYear: 2004 },
  { id: "guehi", name: "Marc Guéhi", clubId: "crystal-palace", position: "DF", bornYear: 2000 },

  // Everton
  { id: "pickford", name: "Jordan Pickford", clubId: "everton", position: "GK", bornYear: 1994 },
  { id: "ndiaye", name: "Iliman Ndiaye", clubId: "everton", position: "FW", bornYear: 2000 },
  { id: "beto", name: "Beto", clubId: "everton", position: "FW", bornYear: 1998 },
  { id: "branthwaite", name: "Jarrad Branthwaite", clubId: "everton", position: "DF", bornYear: 2002 },

  // Fulham
  { id: "leno", name: "Bernd Leno", clubId: "fulham", position: "GK", bornYear: 1992 },
  { id: "jimenez", name: "Raúl Jiménez", clubId: "fulham", position: "FW", bornYear: 1991 },
  { id: "iwobi", name: "Alex Iwobi", clubId: "fulham", position: "MF", bornYear: 1996 },
  { id: "smith-rowe", name: "Emile Smith Rowe", clubId: "fulham", position: "MF", bornYear: 2000 },

  // Hull City — PLACEHOLDER, newly promoted, squad not verified
  { id: "hul-gk", name: "Hull goalkeeper (PLACEHOLDER)", clubId: "hull", position: "GK", bornYear: 1996 },
  { id: "hul-fw", name: "Hull forward (PLACEHOLDER)", clubId: "hull", position: "FW", bornYear: 1999 },
  { id: "hul-mf", name: "Hull midfielder (PLACEHOLDER)", clubId: "hull", position: "MF", bornYear: 2001 },

  // Ipswich Town — PLACEHOLDER-heavy, newly promoted
  { id: "muric", name: "Arijanet Muric", clubId: "ipswich", position: "GK", bornYear: 1998 },
  { id: "hutchinson", name: "Omari Hutchinson", clubId: "ipswich", position: "MF", bornYear: 2003 },
  { id: "ips-fw", name: "Ipswich forward (PLACEHOLDER)", clubId: "ipswich", position: "FW", bornYear: 1999 },

  // Leeds United
  { id: "meslier", name: "Illan Meslier", clubId: "leeds", position: "GK", bornYear: 2000 },
  { id: "gnonto", name: "Wilfried Gnonto", clubId: "leeds", position: "FW", bornYear: 2003 },
  { id: "james", name: "Daniel James", clubId: "leeds", position: "FW", bornYear: 1997 },
  { id: "ampadu", name: "Ethan Ampadu", clubId: "leeds", position: "MF", bornYear: 2000 },

  // Liverpool
  { id: "alisson", name: "Alisson", clubId: "liverpool", position: "GK", bornYear: 1992 },
  { id: "salah", name: "Mohamed Salah", clubId: "liverpool", position: "FW", bornYear: 1992 },
  { id: "van-dijk", name: "Virgil van Dijk", clubId: "liverpool", position: "DF", bornYear: 1991 },
  { id: "gravenberch", name: "Ryan Gravenberch", clubId: "liverpool", position: "MF", bornYear: 2002 },
  { id: "gakpo", name: "Cody Gakpo", clubId: "liverpool", position: "FW", bornYear: 1999 },
  { id: "szoboszlai", name: "Dominik Szoboszlai", clubId: "liverpool", position: "MF", bornYear: 2000 },
  { id: "wirtz", name: "Florian Wirtz", clubId: "liverpool", position: "MF", bornYear: 2003 },

  // Manchester City
  { id: "ederson", name: "Ederson", clubId: "man-city", position: "GK", bornYear: 1993 },
  { id: "haaland", name: "Erling Haaland", clubId: "man-city", position: "FW", bornYear: 2000 },
  { id: "foden", name: "Phil Foden", clubId: "man-city", position: "MF", bornYear: 2000 },
  { id: "rodri", name: "Rodri", clubId: "man-city", position: "MF", bornYear: 1996 },
  { id: "b-silva", name: "Bernardo Silva", clubId: "man-city", position: "MF", bornYear: 1994 },
  { id: "gvardiol", name: "Joško Gvardiol", clubId: "man-city", position: "DF", bornYear: 2002 },
  { id: "cherki", name: "Rayan Cherki", clubId: "man-city", position: "MF", bornYear: 2003 },

  // Manchester United
  { id: "onana", name: "André Onana", clubId: "man-united", position: "GK", bornYear: 1996 },
  { id: "bruno", name: "Bruno Fernandes", clubId: "man-united", position: "MF", bornYear: 1994 },
  { id: "mbeumo", name: "Bryan Mbeumo", clubId: "man-united", position: "FW", bornYear: 1999 },
  { id: "mainoo", name: "Kobbie Mainoo", clubId: "man-united", position: "MF", bornYear: 2005 },
  { id: "garnacho", name: "Alejandro Garnacho", clubId: "man-united", position: "FW", bornYear: 2004 },
  { id: "cunha", name: "Matheus Cunha", clubId: "man-united", position: "FW", bornYear: 1999 },

  // Newcastle United
  { id: "pope", name: "Nick Pope", clubId: "newcastle", position: "GK", bornYear: 1992 },
  { id: "isak", name: "Alexander Isak", clubId: "newcastle", position: "FW", bornYear: 1999 },
  { id: "bruno-g", name: "Bruno Guimarães", clubId: "newcastle", position: "MF", bornYear: 1997 },
  { id: "gordon", name: "Anthony Gordon", clubId: "newcastle", position: "FW", bornYear: 2001 },
  { id: "tonali", name: "Sandro Tonali", clubId: "newcastle", position: "MF", bornYear: 2000 },

  // Nottingham Forest
  { id: "sels", name: "Matz Sels", clubId: "nottingham-forest", position: "GK", bornYear: 1992 },
  { id: "wood", name: "Chris Wood", clubId: "nottingham-forest", position: "FW", bornYear: 1991 },
  { id: "gibbs-white", name: "Morgan Gibbs-White", clubId: "nottingham-forest", position: "MF", bornYear: 2000 },
  { id: "hudson-odoi", name: "Callum Hudson-Odoi", clubId: "nottingham-forest", position: "FW", bornYear: 2000 },
  { id: "murillo", name: "Murillo", clubId: "nottingham-forest", position: "DF", bornYear: 2002 },

  // Sunderland
  { id: "patterson", name: "Anthony Patterson", clubId: "sunderland", position: "GK", bornYear: 2000 },
  { id: "j-bellingham", name: "Jobe Bellingham", clubId: "sunderland", position: "MF", bornYear: 2005 },
  { id: "isidor", name: "Wilson Isidor", clubId: "sunderland", position: "FW", bornYear: 2000 },
  { id: "ballard", name: "Dan Ballard", clubId: "sunderland", position: "DF", bornYear: 1999 },

  // Tottenham Hotspur
  { id: "vicario", name: "Guglielmo Vicario", clubId: "tottenham", position: "GK", bornYear: 1996 },
  { id: "maddison", name: "James Maddison", clubId: "tottenham", position: "MF", bornYear: 1996 },
  { id: "kulusevski", name: "Dejan Kulusevski", clubId: "tottenham", position: "MF", bornYear: 2000 },
  { id: "van-de-ven", name: "Micky van de Ven", clubId: "tottenham", position: "DF", bornYear: 2001 },
  { id: "johnson", name: "Brennan Johnson", clubId: "tottenham", position: "FW", bornYear: 2001 },
  { id: "solanke", name: "Dominic Solanke", clubId: "tottenham", position: "FW", bornYear: 1997 },
];

/**
 * Exactly one manager per club — Manager of the Season is picked from this
 * list, so it must stay 1:1 with CLUBS. A test asserts that.
 */
export const MANAGERS: readonly Manager[] = [
  { id: "mgr-arsenal", name: "Mikel Arteta", clubId: "arsenal" },
  { id: "mgr-aston-villa", name: "Unai Emery", clubId: "aston-villa" },
  { id: "mgr-bournemouth", name: "Andoni Iraola", clubId: "bournemouth" },
  { id: "mgr-brentford", name: "Keith Andrews", clubId: "brentford" },
  { id: "mgr-brighton", name: "Fabian Hürzeler", clubId: "brighton" },
  { id: "mgr-chelsea", name: "Enzo Maresca", clubId: "chelsea" },
  { id: "mgr-coventry", name: "Frank Lampard", clubId: "coventry" },
  { id: "mgr-crystal-palace", name: "Oliver Glasner", clubId: "crystal-palace" },
  { id: "mgr-everton", name: "David Moyes", clubId: "everton" },
  { id: "mgr-fulham", name: "Marco Silva", clubId: "fulham" },
  { id: "mgr-hull", name: "Hull manager (PLACEHOLDER)", clubId: "hull" },
  { id: "mgr-ipswich", name: "Kieran McKenna", clubId: "ipswich" },
  { id: "mgr-leeds", name: "Daniel Farke", clubId: "leeds" },
  { id: "mgr-liverpool", name: "Arne Slot", clubId: "liverpool" },
  { id: "mgr-man-city", name: "Pep Guardiola", clubId: "man-city" },
  { id: "mgr-man-united", name: "Rúben Amorim", clubId: "man-united" },
  { id: "mgr-newcastle", name: "Eddie Howe", clubId: "newcastle" },
  { id: "mgr-nottingham-forest", name: "Nuno Espírito Santo", clubId: "nottingham-forest" },
  { id: "mgr-sunderland", name: "Régis Le Bris", clubId: "sunderland" },
  { id: "mgr-tottenham", name: "Thomas Frank", clubId: "tottenham" },
];

const PLAYER_BY_ID = new Map(PLAYERS.map((p) => [p.id, p]));
const MANAGER_BY_ID = new Map(MANAGERS.map((m) => [m.id, m]));

export function getPlayer(id: string): Player | undefined {
  return PLAYER_BY_ID.get(id);
}

export function getManager(id: string): Manager | undefined {
  return MANAGER_BY_ID.get(id);
}

/** Display name for any award pick, player or manager, falling back to the
 *  raw id so a stale stored prediction still renders as something. */
export function personName(id: string): string {
  return PLAYER_BY_ID.get(id)?.name ?? MANAGER_BY_ID.get(id)?.name ?? id;
}

export function personClubId(id: string): ClubId | undefined {
  return PLAYER_BY_ID.get(id)?.clubId ?? MANAGER_BY_ID.get(id)?.clubId;
}
