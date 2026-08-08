import { describe, expect, it } from "vitest";
import {
  AWARD_POINTS,
  CHAMPION_BONUS,
  EXACT_POSITION_POINTS,
  MAX_SCORE,
  OFF_BY_ONE_POINTS,
  RELEGATION_BONUS,
  RELEGATION_POSITIONS,
  earnsRelegationBonus,
  tablePointsFor,
} from "./scoring";

describe("tablePointsFor", () => {
  it("pays the exact-position rate for a bullseye", () => {
    expect(tablePointsFor(1, 1)).toBe(EXACT_POSITION_POINTS);
    expect(tablePointsFor(20, 20)).toBe(EXACT_POSITION_POINTS);
  });

  it("pays the off-by-one rate in both directions", () => {
    expect(tablePointsFor(5, 4)).toBe(OFF_BY_ONE_POINTS);
    expect(tablePointsFor(5, 6)).toBe(OFF_BY_ONE_POINTS);
  });

  it("pays nothing from two places out", () => {
    // The boundary that gets misread: two out is already zero, not partial.
    expect(tablePointsFor(5, 3)).toBe(0);
    expect(tablePointsFor(5, 7)).toBe(0);
    expect(tablePointsFor(1, 20)).toBe(0);
  });
});

describe("earnsRelegationBonus", () => {
  it("ignores order within the bottom three", () => {
    // Predicted 18th, went down in 20th — still the full bonus.
    expect(earnsRelegationBonus(18, 20)).toBe(true);
    expect(earnsRelegationBonus(20, 18)).toBe(true);
    expect(earnsRelegationBonus(19, 19)).toBe(true);
  });

  it("pays nothing when either side is outside the drop zone", () => {
    expect(earnsRelegationBonus(17, 20)).toBe(false);
    expect(earnsRelegationBonus(18, 17)).toBe(false);
  });
});

describe("MAX_SCORE", () => {
  it("is 156 — every position exact, plus every bonus and award", () => {
    expect(MAX_SCORE).toBe(156);
  });

  it("adds up from its parts", () => {
    const table = 20 * EXACT_POSITION_POINTS;
    const relegation = RELEGATION_POSITIONS.length * RELEGATION_BONUS;
    const awards = Object.values(AWARD_POINTS).reduce((a, b) => a + b, 0);
    expect(table + CHAMPION_BONUS + relegation + awards).toBe(MAX_SCORE);
  });
});
