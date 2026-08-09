/**
 * The eight non-table predictions: two cup winners and six individual awards.
 *
 * Shortlists are authoritatively supplied by Mert and mapped to their respective
 * club crests and ids.
 */

import { getClub, type ClubId } from "./clubs";
import { AWARD_POINTS } from "./scoring";

export const YOUNG_PLAYER_MAX_AGE = 23;

export type AwardId =
  | "faCup"
  | "carabao"
  | "playerOfSeason"
  | "youngPlayerOfSeason"
  | "managerOfSeason"
  | "goldenBoot"
  | "goldenGlove"
  | "bestPlaymaker";

export type Candidate = {
  id: string;
  name: string;
  subtitle?: string;
  crest?: string;
};

export type Award = {
  id: AwardId;
  label: string;
  blurb: string;
  points: number;
  searchNoun: string;
  candidates: readonly Candidate[];
};

function clubCand(clubId: ClubId, customName?: string): Candidate {
  const club = getClub(clubId);
  return {
    id: clubId,
    name: customName ?? club?.name ?? clubId,
    crest: club?.crest,
  };
}

function personCand(id: string, name: string, clubId: ClubId): Candidate {
  const club = getClub(clubId);
  return {
    id,
    name,
    subtitle: club?.shortName ?? club?.name,
    crest: club?.crest,
  };
}

// 1. FA Cup Winner (10 candidates)
const FA_CUP_CANDIDATES: Candidate[] = [
  clubCand("arsenal"),
  clubCand("man-city"),
  clubCand("chelsea"),
  clubCand("liverpool"),
  clubCand("man-united"),
  clubCand("aston-villa"),
  clubCand("tottenham"),
  clubCand("newcastle"),
  clubCand("brighton"),
  clubCand("coventry"),
];

// 2. Carabao Cup Winner (10 candidates)
const CARABAO_CANDIDATES: Candidate[] = [
  clubCand("man-city"),
  clubCand("arsenal"),
  clubCand("liverpool"),
  clubCand("chelsea"),
  clubCand("man-united"),
  clubCand("tottenham"),
  clubCand("aston-villa"),
  clubCand("newcastle"),
  clubCand("brentford"),
  clubCand("everton"),
];

// 3. Player of the Season (20 candidates)
const PLAYER_OF_SEASON_CANDIDATES: Candidate[] = [
  personCand("erling-haaland", "Erling Haaland", "man-city"),
  personCand("bruno-fernandes", "Bruno Fernandes", "man-united"),
  personCand("declan-rice", "Declan Rice", "arsenal"),
  personCand("william-saliba", "William Saliba", "arsenal"),
  personCand("bukayo-saka", "Bukayo Saka", "arsenal"),
  personCand("morgan-rogers", "Morgan Rogers", "chelsea"),
  personCand("martin-odegaard", "Martin Ødegaard", "arsenal"),
  personCand("cole-palmer", "Cole Palmer", "chelsea"),
  personCand("victor-munoz", "Víctor Muñoz", "liverpool"),
  personCand("elliot-anderson", "Elliot Anderson", "man-city"),
  personCand("rayan-cherki", "Rayan Cherki", "man-city"),
  personCand("alexander-isak", "Alexander Isak", "newcastle"),
  personCand("antoine-semenyo", "Antoine Semenyo", "man-city"),
  personCand("johan-manzambi", "Johan Manzambi", "aston-villa"),
  personCand("sandro-tonali", "Sandro Tonali", "tottenham"),
  personCand("virgil-van-dijk", "Virgil van Dijk", "liverpool"),
  personCand("joao-gomes", "João Gomes", "aston-villa"),
  personCand("florian-wirtz", "Florian Wirtz", "chelsea"),
  personCand("gabriel-magalhaes", "Gabriel Magalhães", "arsenal"),
  personCand("dominik-szoboszlai", "Dominik Szoboszlai", "liverpool"),
];

// 4. Young Player of the Season (20 candidates)
const YOUNG_PLAYER_CANDIDATES: Candidate[] = [
  personCand("geovany-quenda", "Geovany Quenda", "chelsea"),
  personCand("caleb-yirenkyi", "Caleb Yirenkyi", "coventry"),
  personCand("victor-munoz-yp", "Víctor Muñoz", "liverpool"),
  personCand("savinho", "Savinho", "man-city"),
  personCand("alejandro-garnacho", "Alejandro Garnacho", "aston-villa"),
  personCand("claudio-echeverri", "Claudio Echeverri", "man-city"),
  personCand("marco-palestra", "Marco Palestra", "chelsea"),
  personCand("bazoumana-toure", "Bazoumana Touré", "newcastle"),
  personCand("ewen-jaouen", "Ewen Jaouen", "newcastle"),
  personCand("kobbie-mainoo", "Kobbie Mainoo", "man-united"),
  personCand("leny-yoro", "Leny Yoro", "man-united"),
  personCand("max-dowman", "Max Dowman", "arsenal"),
  personCand("sean-steur", "Sean Steur", "newcastle"),
  personCand("dastan-satpaev", "Dastan Satpaev", "chelsea"),
  personCand("aladji-bamba", "Aladji Bamba", "newcastle"),
  personCand("mateus-fernandes", "Mateus Fernandes", "tottenham"),
  personCand("jeremy-jacquet", "Jérémy Jacquet", "liverpool"),
  personCand("giovanni-leoni", "Giovanni Leoni", "liverpool"),
  personCand("antonin-kinsky-yp", "Antonín Kinský", "tottenham"),
  personCand("billy-ray-cullinane", "Billy-Ray Cullinane", "brighton"),
];

// 5. Manager of the Season (10 candidates)
const MANAGER_CANDIDATES: Candidate[] = [
  personCand("mikel-arteta", "Mikel Arteta", "arsenal"),
  personCand("enzo-maresca", "Enzo Maresca", "man-city"),
  personCand("xabi-alonso", "Xabi Alonso", "chelsea"),
  personCand("andoni-iraola", "Andoni Iraola", "liverpool"),
  personCand("michael-carrick", "Michael Carrick", "man-united"),
  personCand("unai-emery", "Unai Emery", "aston-villa"),
  personCand("roberto-de-zerbi", "Roberto De Zerbi", "tottenham"),
  personCand("fabian-hurzeler", "Fabian Hürzeler", "brighton"),
  personCand("frank-lampard", "Frank Lampard", "coventry"),
  personCand("matthias-jaissle", "Matthias Jaissle", "newcastle"),
];

// 6. Golden Boot Winner (10 candidates)
const GOLDEN_BOOT_CANDIDATES: Candidate[] = [
  personCand("erling-haaland-gb", "Erling Haaland", "man-city"),
  personCand("bukayo-saka-gb", "Bukayo Saka", "arsenal"),
  personCand("alexander-isak-gb", "Alexander Isak", "newcastle"),
  personCand("viktor-gyokeres", "Viktor Gyökeres", "arsenal"),
  personCand("cole-palmer-gb", "Cole Palmer", "chelsea"),
  personCand("marcus-rashford-gb", "Marcus Rashford", "man-united"),
  personCand("danny-welbeck", "Danny Welbeck", "chelsea"),
  personCand("joshua-zirkzee", "Joshua Zirkzee", "man-united"),
  personCand("brian-brobbey", "Brian Brobbey", "sunderland"),
  personCand("victor-munoz-gb", "Víctor Muñoz", "liverpool"),
];

// 7. Golden Glove Winner (10 candidates)
const GOLDEN_GLOVE_CANDIDATES: Candidate[] = [
  personCand("david-raya", "David Raya", "arsenal"),
  personCand("gianluigi-donnarumma", "Gianluigi Donnarumma", "man-city"),
  personCand("alisson-becker", "Alisson Becker", "liverpool"),
  personCand("robert-sanchez", "Robert Sánchez", "chelsea"),
  personCand("jordan-pickford", "Jordan Pickford", "everton"),
  personCand("senne-lammens", "Senne Lammens", "man-united"),
  personCand("antonin-kinsky", "Antonín Kinský", "tottenham"),
  personCand("carl-rushworth", "Carl Rushworth", "coventry"),
  personCand("bart-verbruggen", "Bart Verbruggen", "brighton"),
  personCand("caoimhin-kelleher", "Caoimhín Kelleher", "brentford"),
];

// 8. Best Playmaker (20 candidates)
const BEST_PLAYMAKER_CANDIDATES: Candidate[] = [
  personCand("bruno-fernandes-bp", "Bruno Fernandes", "man-united"),
  personCand("martin-odegaard-bp", "Martin Ødegaard", "arsenal"),
  personCand("morgan-rogers-bp", "Morgan Rogers", "chelsea"),
  personCand("rayan-cherki-bp", "Rayan Cherki", "man-city"),
  personCand("cole-palmer-bp", "Cole Palmer", "chelsea"),
  personCand("bukayo-saka-bp", "Bukayo Saka", "arsenal"),
  personCand("elliot-anderson-bp", "Elliot Anderson", "man-city"),
  personCand("johan-manzambi-bp", "Johan Manzambi", "aston-villa"),
  personCand("victor-munoz-bp", "Víctor Muñoz", "liverpool"),
  personCand("dominik-szoboszlai-bp", "Dominik Szoboszlai", "liverpool"),
  personCand("florian-wirtz-bp", "Florian Wirtz", "chelsea"),
  personCand("sandro-tonali-bp", "Sandro Tonali", "tottenham"),
  personCand("youri-tielemans", "Youri Tielemans", "man-united"),
  personCand("antoine-semenyo-bp", "Antoine Semenyo", "man-city"),
  personCand("marcus-rashford-bp", "Marcus Rashford", "man-united"),
  personCand("alejandro-garnacho-bp", "Alejandro Garnacho", "aston-villa"),
  personCand("declan-rice-bp", "Declan Rice", "arsenal"),
  personCand("joao-pedro", "João Pedro", "chelsea"),
  personCand("xavi-simons", "Xavi Simons", "tottenham"),
  personCand("eberechi-eze", "Eberechi Eze", "crystal-palace"),
];

export const AWARDS: readonly Award[] = [
  {
    id: "faCup",
    label: "FA Cup Winner",
    blurb: "Who lifts the FA Cup.",
    points: AWARD_POINTS.faCup,
    searchNoun: "clubs",
    candidates: FA_CUP_CANDIDATES,
  },
  {
    id: "carabao",
    label: "Carabao Cup Winner",
    blurb: "Who lifts the League Cup.",
    points: AWARD_POINTS.carabao,
    searchNoun: "clubs",
    candidates: CARABAO_CANDIDATES,
  },
  {
    id: "playerOfSeason",
    label: "Player of the Season",
    blurb: "The season's outstanding player.",
    points: AWARD_POINTS.playerOfSeason,
    searchNoun: "players",
    candidates: PLAYER_OF_SEASON_CANDIDATES,
  },
  {
    id: "youngPlayerOfSeason",
    label: "Young Player of the Season",
    blurb: "Young player of the season.",
    points: AWARD_POINTS.youngPlayerOfSeason,
    searchNoun: "players",
    candidates: YOUNG_PLAYER_CANDIDATES,
  },
  {
    id: "managerOfSeason",
    label: "Manager of the Season",
    blurb: "Manager of the season.",
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
    candidates: GOLDEN_BOOT_CANDIDATES,
  },
  {
    id: "goldenGlove",
    label: "Golden Glove",
    blurb: "Most clean sheets across the season.",
    points: AWARD_POINTS.goldenGlove,
    searchNoun: "goalkeepers",
    candidates: GOLDEN_GLOVE_CANDIDATES,
  },
  {
    id: "bestPlaymaker",
    label: "Best Playmaker",
    blurb: "Most league assists across the season.",
    points: AWARD_POINTS.bestPlaymaker,
    searchNoun: "players",
    candidates: BEST_PLAYMAKER_CANDIDATES,
  },
];

export const AWARD_IDS: readonly AwardId[] = AWARDS.map((a) => a.id);

const AWARD_BY_ID = new Map<string, Award>(AWARDS.map((a) => [a.id, a]));

export function getAward(id: string): Award | undefined {
  return AWARD_BY_ID.get(id);
}

export function candidateName(awardId: AwardId, candidateId: string): string {
  const award = AWARD_BY_ID.get(awardId);
  return award?.candidates.find((c) => c.id === candidateId)?.name ?? candidateId;
}

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
    .replace(/ø/g, "o")
    .replace(/Ø/g, "O")
    .toLowerCase();
}
