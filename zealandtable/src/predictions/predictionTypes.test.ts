import { describe, expect, it } from "vitest";
import { CLUBS } from "@/data/clubs";
import { AWARD_IDS } from "@/data/awards";
import { awardsFrom, positionOf, validateDraft, type AwardPicks } from "./predictionTypes";

// Typed as string[] rather than ClubId[] on purpose: these tests need to put
// a club that isn't in the roster into the table, which is exactly the case
// validateDraft exists to reject.
const fullTable = (): string[] => CLUBS.map((c) => c.id);
const fullAwards = (): AwardPicks =>
  Object.fromEntries(AWARD_IDS.map((id) => [id, "something"])) as AwardPicks;

describe("validateDraft", () => {
  it("accepts a complete draft", () => {
    expect(validateDraft({ table: fullTable(), awards: fullAwards() })).toEqual({ ok: true });
  });

  it("rejects a short table", () => {
    const result = validateDraft({ table: fullTable().slice(0, 19), awards: fullAwards() });
    expect(result.ok).toBe(false);
  });

  it("rejects a duplicated club", () => {
    const table = fullTable();
    table[5] = table[0]!;
    const result = validateDraft({ table, awards: fullAwards() });
    expect(result).toMatchObject({ ok: false, reason: "A club appears twice in the table." });
  });

  it("rejects a club that isn't in this season's roster", () => {
    const table = fullTable();
    table[0] = "wolves";
    const result = validateDraft({ table, awards: fullAwards() });
    expect(result).toMatchObject({
      ok: false,
      reason: "The table contains a club we don't recognise.",
    });
  });

  it("counts missing award picks, singular and plural", () => {
    const awards = fullAwards();
    delete awards.goldenBoot;
    expect(validateDraft({ table: fullTable(), awards })).toMatchObject({
      ok: false,
      reason: "One award pick is still empty.",
    });

    delete awards.goldenGlove;
    expect(validateDraft({ table: fullTable(), awards })).toMatchObject({
      ok: false,
      reason: "2 award picks are still empty.",
    });
  });

  it("rejects an empty draft", () => {
    expect(validateDraft({ table: [], awards: {} }).ok).toBe(false);
  });
});

describe("positionOf", () => {
  it("is 1-based — index 0 is the predicted champion", () => {
    const table = fullTable();
    expect(positionOf(table, table[0]!)).toBe(1);
    expect(positionOf(table, table[19]!)).toBe(20);
  });

  it("is undefined for a club that isn't in the table", () => {
    expect(positionOf(fullTable(), "wolves")).toBeUndefined();
  });
});

describe("awardsFrom", () => {
  it("returns nothing for a missing prediction", () => {
    expect(awardsFrom(null)).toEqual({});
  });

  it("pulls the eight picks off a stored document", () => {
    const stored = {
      table: fullTable(),
      faCup: "arsenal",
      carabao: "chelsea",
      playerOfSeason: "salah",
      youngPlayerOfSeason: "mainoo",
      managerOfSeason: "mgr-arsenal",
      goldenBoot: "haaland",
      goldenGlove: "raya",
      bestPlaymaker: "palmer",
      submittedAt: 1,
      updatedAt: 2,
    };
    expect(awardsFrom(stored)).toEqual({
      faCup: "arsenal",
      carabao: "chelsea",
      playerOfSeason: "salah",
      youngPlayerOfSeason: "mainoo",
      managerOfSeason: "mgr-arsenal",
      goldenBoot: "haaland",
      goldenGlove: "raya",
      bestPlaymaker: "palmer",
    });
  });

  it("skips empty strings rather than reporting a pick that was never made", () => {
    const stored = {
      table: fullTable(),
      faCup: "arsenal",
      carabao: "",
      playerOfSeason: "",
      youngPlayerOfSeason: "",
      managerOfSeason: "",
      goldenBoot: "",
      goldenGlove: "",
      bestPlaymaker: "",
      submittedAt: 1,
      updatedAt: 2,
    };
    expect(awardsFrom(stored)).toEqual({ faCup: "arsenal" });
  });
});
