import { describe, it, expect } from "vitest";
import {
  ESSENCE_TEXT,
  KEY_DATES,
  currentThresholdFor,
  formatChipDate,
  getDateStatus,
} from "./aboutContent";
import { PREDICTIONS_CLOSE_MS, SEASON_START_MS } from "@/data/deadlines";
import { MAX_SCORE } from "@/data/scoring";
import { AWARDS } from "@/data/awards";
import { CLUB_COUNT } from "@/data/clubs";

describe("formatChipDate", () => {
  // The bug this exists to catch: entries close at 23:59:59 BST on the 21st,
  // one second short of midnight. Formatted with the viewer's local getDate()
  // that reads as the 22nd anywhere east of the UK — which made the timeline
  // show "22 Aug" for both entries-close and season-start, two different
  // instants collapsed onto one label.
  it("renders a day-granular date in UK time, not the viewer's", () => {
    const entriesClose = KEY_DATES.find((d) => d.label === "Entries Close")!;
    const seasonStart = KEY_DATES.find((d) => d.label === "Season Starts")!;
    expect(formatChipDate(entriesClose)).toBe("21 Aug");
    expect(formatChipDate(seasonStart)).toBe("22 Aug");
  });

  it("renders a month-granular date as month and year, with no invented day", () => {
    const monthNodes = KEY_DATES.filter((d) => d.granularity === "month");
    expect(monthNodes.length).toBeGreaterThan(0);
    for (const node of monthNodes) {
      expect(formatChipDate(node)).toMatch(/^[A-Z][a-z]{2} \d{4}$/);
    }
  });

  it("gives every node a distinct label, so no two read as the same moment", () => {
    const rendered = KEY_DATES.map(formatChipDate);
    // The two May nodes are deliberately both "May 2027" — they are only
    // known to the month. Everything else has to be distinguishable.
    const dayNodes = KEY_DATES.filter((d) => d.granularity === "day").map(formatChipDate);
    expect(new Set(dayNodes).size).toBe(dayNodes.length);
    expect(rendered).toHaveLength(KEY_DATES.length);
  });
});

describe("KEY_DATES", () => {
  it("is in chronological order", () => {
    const times = KEY_DATES.map((d) => d.date.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it("takes its first two nodes from deadlines.ts rather than restating them", () => {
    expect(KEY_DATES[0].date.getTime()).toBe(PREDICTIONS_CLOSE_MS);
    expect(KEY_DATES[1].date.getTime()).toBe(SEASON_START_MS);
  });
});

describe("currentThresholdFor / getDateStatus", () => {
  const before = KEY_DATES[0].date.getTime() - 1;
  const between = KEY_DATES[1].date.getTime() + 1;
  const after = KEY_DATES[KEY_DATES.length - 1].date.getTime() + 1;

  it("marks the next upcoming node as current and everything before it as past", () => {
    const threshold = currentThresholdFor(between);
    expect(threshold).toBe(KEY_DATES[2].date.getTime());
    expect(getDateStatus(KEY_DATES[0].date, between, threshold)).toBe("past");
    expect(getDateStatus(KEY_DATES[1].date, between, threshold)).toBe("past");
    expect(getDateStatus(KEY_DATES[2].date, between, threshold)).toBe("current");
    expect(getDateStatus(KEY_DATES[3].date, between, threshold)).toBe("future");
  });

  it("marks the very first node current before anything has happened", () => {
    const threshold = currentThresholdFor(before);
    expect(getDateStatus(KEY_DATES[0].date, before, threshold)).toBe("current");
  });

  it("has no current node once every date is past", () => {
    expect(currentThresholdFor(after)).toBeNull();
    expect(getDateStatus(KEY_DATES[0].date, after, null)).toBe("past");
  });
});

// The standing rule: no scoring figure is ever restated in copy.
describe("ESSENCE_TEXT", () => {
  it("interpolates the real numbers rather than hard-coding them", () => {
    expect(ESSENCE_TEXT).toContain(String(MAX_SCORE));
    expect(ESSENCE_TEXT).toContain(String(AWARDS.length));
    expect(ESSENCE_TEXT).toContain(String(CLUB_COUNT));
  });
});
