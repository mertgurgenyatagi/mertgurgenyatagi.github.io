import { describe, expect, it } from "vitest";
import {
  PREDICTIONS_CLOSE_MS,
  SEASON_START_MS,
  countdownTo,
  formatDeadline,
  predictionsAreOpen,
} from "./deadlines";

describe("the deadline", () => {
  it("is 21 August 2026, UK time", () => {
    expect(formatDeadline()).toBe("21 August 2026");
  });

  it("falls before the season starts", () => {
    expect(PREDICTIONS_CLOSE_MS).toBeLessThan(SEASON_START_MS);
  });
});

describe("predictionsAreOpen", () => {
  it("is open a day before", () => {
    expect(predictionsAreOpen(PREDICTIONS_CLOSE_MS - 86_400_000)).toBe(true);
  });

  it("is still open on the exact millisecond of the deadline", () => {
    expect(predictionsAreOpen(PREDICTIONS_CLOSE_MS)).toBe(true);
  });

  it("is closed one millisecond later", () => {
    expect(predictionsAreOpen(PREDICTIONS_CLOSE_MS + 1)).toBe(false);
  });
});

describe("countdownTo", () => {
  it("breaks a remaining span into days, hours, minutes and seconds", () => {
    const target = 1_000_000_000_000;
    const now = target - (2 * 86_400_000 + 3 * 3_600_000 + 4 * 60_000 + 5 * 1000);
    expect(countdownTo(target, now)).toEqual({
      days: 2,
      hours: 3,
      minutes: 4,
      seconds: 5,
      expired: false,
    });
  });

  it("floors at zero rather than counting negative once the target passes", () => {
    const target = 1_000_000_000_000;
    expect(countdownTo(target, target + 5_000)).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      expired: true,
    });
  });

  it("reports expired exactly at the target", () => {
    const target = 1_000_000_000_000;
    expect(countdownTo(target, target).expired).toBe(true);
  });
});
