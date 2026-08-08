import { describe, expect, it } from "vitest";
import { AWARDS, AWARD_IDS, candidateName, searchCandidates } from "./awards";

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

describe("shortlist candidates", () => {
  it("offers 10 clubs for both cups", () => {
    for (const id of ["faCup", "carabao"] as const) {
      const award = AWARDS.find((a) => a.id === id)!;
      expect(award.candidates.length).toBe(10);
    }
  });

  it("offers 10 managers for Manager of the Season", () => {
    const award = AWARDS.find((a) => a.id === "managerOfSeason")!;
    expect(award.candidates.length).toBe(10);
  });

  it("offers 20 players for Player of the Season", () => {
    const award = AWARDS.find((a) => a.id === "playerOfSeason")!;
    expect(award.candidates.length).toBe(20);
  });
});

describe("candidate search", () => {
  const potm = AWARDS.find((a) => a.id === "playerOfSeason")!;

  it("returns everything for an empty query", () => {
    expect(searchCandidates(potm, "  ").length).toBe(potm.candidates.length);
  });

  it("matches case-insensitively", () => {
    const hits = searchCandidates(potm, "SAKA");
    expect(hits.some((c) => c.name === "Bukayo Saka")).toBe(true);
  });

  it("matches through accents, so 'odegaard' finds Ødegaard", () => {
    const hits = searchCandidates(potm, "odegaard");
    expect(hits.some((c) => c.name === "Martin Ødegaard")).toBe(true);
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
