import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CLUBS, CLUB_COUNT, clubName, getClub, isClubId } from "./clubs";

describe("the club roster", () => {
  it("has exactly 20 clubs", () => {
    expect(CLUB_COUNT).toBe(20);
  });

  it("has no duplicate ids, names or codes", () => {
    expect(new Set(CLUBS.map((c) => c.id)).size).toBe(CLUB_COUNT);
    expect(new Set(CLUBS.map((c) => c.name)).size).toBe(CLUB_COUNT);
    expect(new Set(CLUBS.map((c) => c.code)).size).toBe(CLUB_COUNT);
  });

  it("is sorted alphabetically by name — the ranker seeds from this order", () => {
    const names = CLUBS.map((c) => c.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("uses three-letter codes throughout", () => {
    for (const club of CLUBS) {
      expect(club.code).toMatch(/^[A-Z]{3}$/);
    }
  });

  /**
   * The crest paths in clubs.ts and the files the import script writes are two
   * separate lists that have to agree. This is the test that catches a renamed
   * source file or a typo'd slug, rather than a 404 nobody notices until the
   * ranker renders twenty empty boxes.
   */
  it("has a real crest file behind every club", () => {
    const publicDir = join(__dirname, "..", "..", "public");
    const missing = CLUBS.filter((club) => !existsSync(join(publicDir, club.crest)));
    expect(missing.map((c) => c.crest)).toEqual([]);
  });
});

describe("club lookups", () => {
  it("resolves a known id", () => {
    expect(getClub("arsenal")?.name).toBe("Arsenal");
    expect(isClubId("arsenal")).toBe(true);
  });

  it("rejects an unknown id", () => {
    expect(getClub("real-madrid")).toBeUndefined();
    expect(isClubId("real-madrid")).toBe(false);
  });

  it("falls back to the raw id so a stale prediction never renders blank", () => {
    expect(clubName("some-relegated-club")).toBe("some-relegated-club");
  });
});
