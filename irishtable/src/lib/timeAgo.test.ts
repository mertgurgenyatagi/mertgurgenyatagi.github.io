import { describe, expect, it } from "vitest";
import { timeAgo } from "./timeAgo";

const NOW = 1_700_000_000_000;

describe("timeAgo", () => {
  it("collapses anything under a minute to 'just now'", () => {
    expect(timeAgo(NOW - 5_000, NOW)).toBe("just now");
    expect(timeAgo(NOW - 44_000, NOW)).toBe("just now");
  });

  it("counts minutes and hours", () => {
    expect(timeAgo(NOW - 5 * 60_000, NOW)).toBe("5 mins ago");
    expect(timeAgo(NOW - 60 * 60_000, NOW)).toBe("1 hour ago");
    expect(timeAgo(NOW - 5 * 60 * 60_000, NOW)).toBe("5 hours ago");
  });

  it("says yesterday rather than '1 days ago'", () => {
    expect(timeAgo(NOW - 25 * 60 * 60_000, NOW)).toBe("yesterday");
  });

  /**
   * createdAt is written from the poster's own clock, not a server timestamp,
   * so a skewed device can genuinely produce a future value. "in 3 hours" on
   * a message that already exists reads as a bug.
   */
  it("treats a future timestamp as 'just now' rather than counting forward", () => {
    expect(timeAgo(NOW + 3 * 60 * 60_000, NOW)).toBe("just now");
  });

  it("survives junk values", () => {
    expect(timeAgo(Number.NaN, NOW)).toBe("just now");
    expect(timeAgo(Number.POSITIVE_INFINITY, NOW)).toBe("just now");
    expect(timeAgo(0, NOW)).toBe("just now");
  });
});
