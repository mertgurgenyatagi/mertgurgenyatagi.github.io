import { describe, expect, it } from "vitest";
import { AWARDS, AWARD_IDS, YOUNG_PLAYER_MAX_AGE, candidateName, searchCandidates } from "./awards";
import { CLUBS, CLUB_COUNT } from "./clubs";
import { MANAGERS, PLAYERS, SEASON_START_YEAR } from "./people";

describe("the award set", () => {
  it("covers the two cups and the six individual awards", () => {
    expect(AWARD_IDS).toEqual([
      "faCup",
      "carabao",
      "playerOfSeason",
      "youngPlayerOfSeason",
      "managerOfSeason",
      "goldenBoot",
      "goldenGlove",
      "bestPlaymaker",
    ]);
  });

  it("gives every award a non-empty shortlist", () => {
    for (const award of AWARDS) {
      expect(award.candidates.length, `${award.id} has no candidates`).toBeGreaterThan(0);
    }
  });

  it("has no duplicate candidate ids within a shortlist", () => {
    for (const award of AWARDS) {
      const ids = award.candidates.map((c) => c.id);
      expect(new Set(ids).size, `${award.id} has duplicates`).toBe(ids.length);
    }
  });

  it("carries a positive point value on every award", () => {
    for (const award of AWARDS) {
      expect(award.points).toBeGreaterThan(0);
    }
  });
});

describe("shortlist derivation", () => {
  it("offers all 20 clubs for both cups", () => {
    for (const id of ["faCup", "carabao"] as const) {
      const award = AWARDS.find((a) => a.id === id)!;
      expect(award.candidates.length).toBe(CLUB_COUNT);
    }
  });

  it("offers exactly one manager per club", () => {
    const award = AWARDS.find((a) => a.id === "managerOfSeason")!;
    expect(award.candidates.length).toBe(CLUB_COUNT);
    expect(new Set(MANAGERS.map((m) => m.clubId)).size).toBe(CLUB_COUNT);
  });

  it("restricts Golden Glove to goalkeepers", () => {
    const award = AWARDS.find((a) => a.id === "goldenGlove")!;
    const keeperIds = new Set(PLAYERS.filter((p) => p.position === "GK").map((p) => p.id));
    expect(award.candidates.length).toBe(keeperIds.size);
    for (const candidate of award.candidates) {
      expect(keeperIds.has(candidate.id)).toBe(true);
    }
  });

  it("gives every club a goalkeeper, so Golden Glove can't miss a club", () => {
    const clubsWithKeeper = new Set(
      PLAYERS.filter((p) => p.position === "GK").map((p) => p.clubId)
    );
    const clubsWithout = CLUBS.filter((c) => !clubsWithKeeper.has(c.id));
    expect(clubsWithout.map((c) => c.id)).toEqual([]);
  });

  it("restricts Young Player to the U23 cutoff", () => {
    const award = AWARDS.find((a) => a.id === "youngPlayerOfSeason")!;
    const eligible = new Set(
      PLAYERS.filter((p) => SEASON_START_YEAR - p.bornYear <= YOUNG_PLAYER_MAX_AGE).map(
        (p) => p.id
      )
    );
    expect(award.candidates.length).toBe(eligible.size);
    for (const candidate of award.candidates) {
      expect(eligible.has(candidate.id)).toBe(true);
    }
  });

  it("keeps defenders and keepers out of Golden Boot", () => {
    const award = AWARDS.find((a) => a.id === "goldenBoot")!;
    const byId = new Map(PLAYERS.map((p) => [p.id, p]));
    for (const candidate of award.candidates) {
      const position = byId.get(candidate.id)?.position;
      expect(position === "FW" || position === "MF").toBe(true);
    }
  });

  it("sorts player shortlists alphabetically", () => {
    const award = AWARDS.find((a) => a.id === "playerOfSeason")!;
    const names = award.candidates.map((c) => c.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
});

describe("candidate search", () => {
  const potm = AWARDS.find((a) => a.id === "playerOfSeason")!;

  it("returns everything for an empty query", () => {
    expect(searchCandidates(potm, "  ").length).toBe(potm.candidates.length);
  });

  it("matches case-insensitively", () => {
    const hits = searchCandidates(potm, "SALAH");
    expect(hits.some((c) => c.name === "Mohamed Salah")).toBe(true);
  });

  it("matches through accents, so 'odegaard' finds Ødegaard", () => {
    const hits = searchCandidates(potm, "Fernandez");
    expect(hits.some((c) => c.name === "Enzo Fernández")).toBe(true);
  });

  it("matches on the club subtitle too", () => {
    const hits = searchCandidates(potm, "Liverpool");
    expect(hits.length).toBeGreaterThan(0);
  });
});

describe("candidateName", () => {
  it("resolves a real pick", () => {
    expect(candidateName("faCup", "arsenal")).toBe("Arsenal");
  });

  it("falls back to the stored id for a pick that no longer exists", () => {
    expect(candidateName("goldenBoot", "some-transferred-player")).toBe(
      "some-transferred-player"
    );
  });
});
