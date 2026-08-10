import { describe, it, expect } from "vitest";
import { buildScoringExampleWindow, pickFallbackTeam } from "./scoringExampleWindow";
import { BOUNDARY_SPAN } from "./predictionBoundary";
import { CLUBS } from "@/data/clubs";

// Real clubs rather than a synthetic fixture: `Team` is `Club`, whose `id` is
// a union of the twenty real ids, so a made-up `t0` cannot be cast into one
// without lying to the compiler.
const teams = CLUBS.slice(0, 10);
const id = (i: number) => teams[i].id;

// The window is BOUNDARY_SPAN either side of the centre, plus one non-scoring
// row at each end so the diagram shows a boundary rather than a solid block.
const WINDOW_SIZE = BOUNDARY_SPAN * 2 + 3;
const HALF = Math.floor(WINDOW_SIZE / 2);

describe("buildScoringExampleWindow", () => {
  it("is wide enough to show a non-scoring row on each side of the band", () => {
    expect(WINDOW_SIZE).toBe(5);
  });

  it("centres the window on the given club when there's room either side", () => {
    const result = buildScoringExampleWindow([...teams], id(5));
    expect(result.teams).toHaveLength(WINDOW_SIZE);
    expect(result.teams.map((t) => t.id)).toEqual([id(3), id(4), id(5), id(6), id(7)]);
    expect(result.centerIndex).toBe(HALF);
  });

  it("clamps the window at the start of the list, shifting the centre instead", () => {
    const result = buildScoringExampleWindow([...teams], id(0));
    expect(result.teams.map((t) => t.id)).toEqual([id(0), id(1), id(2), id(3), id(4)]);
    expect(result.centerIndex).toBe(0);
  });

  it("clamps the window at the end of the list, shifting the centre instead", () => {
    const result = buildScoringExampleWindow([...teams], id(9));
    expect(result.teams.map((t) => t.id)).toEqual([id(5), id(6), id(7), id(8), id(9)]);
    expect(result.centerIndex).toBe(WINDOW_SIZE - 1);
  });

  it("falls back to the first slice if the id doesn't match anything", () => {
    const result = buildScoringExampleWindow([...teams], "does-not-exist");
    expect(result.teams).toHaveLength(WINDOW_SIZE);
    expect(result.centerIndex).toBe(0);
  });
});

describe("pickFallbackTeam", () => {
  it("deterministically picks the same club for the same uid", () => {
    expect(pickFallbackTeam([...teams], "uid-123")).toEqual(pickFallbackTeam([...teams], "uid-123"));
  });

  it("picks a club that's actually in the list", () => {
    expect(teams).toContainEqual(pickFallbackTeam([...teams], "some-uid"));
  });
});
