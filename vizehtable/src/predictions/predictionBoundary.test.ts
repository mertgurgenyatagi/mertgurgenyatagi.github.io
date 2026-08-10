import { describe, it, expect } from "vitest";
import { BOUNDARY_SPAN, boundaryBand, boundaryBandRole } from "./predictionBoundary";
import { CLUB_COUNT } from "@/data/clubs";

// The parent hard-codes a span of 2 because its rule is "within 2 places".
// irishtable derives it from tablePointsFor, which pays out to exactly one
// place either way — so if someone changes the rulebook, this test is the one
// that notices the bracket changed shape with it.
describe("BOUNDARY_SPAN", () => {
  it("is one row, matching the off-by-one rule in scoring.ts", () => {
    expect(BOUNDARY_SPAN).toBe(1);
  });
});

describe("boundaryBand", () => {
  it("spans one row either side of a middle index", () => {
    expect(boundaryBand(10, CLUB_COUNT)).toEqual([9, 11]);
  });

  it("clamps at the top of the list", () => {
    expect(boundaryBand(0, CLUB_COUNT)).toEqual([0, 1]);
    expect(boundaryBand(1, CLUB_COUNT)).toEqual([0, 2]);
  });

  it("clamps at the bottom of the list", () => {
    expect(boundaryBand(19, CLUB_COUNT)).toEqual([18, 19]);
    expect(boundaryBand(18, CLUB_COUNT)).toEqual([17, 19]);
  });
});

describe("boundaryBandRole", () => {
  it("marks the band's first row as top and last row as bottom", () => {
    expect(boundaryBandRole(9, 10, CLUB_COUNT)).toBe("top");
    expect(boundaryBandRole(11, 10, CLUB_COUNT)).toBe("bottom");
  });

  it("marks the hovered row itself as middle", () => {
    expect(boundaryBandRole(10, 10, CLUB_COUNT)).toBe("middle");
  });

  it("is none for a row outside the band", () => {
    expect(boundaryBandRole(8, 10, CLUB_COUNT)).toBe("none");
    expect(boundaryBandRole(12, 10, CLUB_COUNT)).toBe("none");
  });

  it("collapses top and bottom onto the same row when the band clips at the list's edge", () => {
    expect(boundaryBandRole(0, 0, CLUB_COUNT)).toBe("top");
    expect(boundaryBandRole(1, 0, CLUB_COUNT)).toBe("bottom");
  });
});
