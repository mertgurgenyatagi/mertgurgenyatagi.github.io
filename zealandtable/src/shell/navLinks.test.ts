import { describe, expect, it } from "vitest";
import { REQUIRES_LOGIN, canAccess, navLinksFor, type PageId } from "./navLinks";

const ALL_PAGES = Object.keys(REQUIRES_LOGIN) as PageId[];

describe("access control", () => {
  it("opens Home, About and Scoring to everyone", () => {
    for (const page of ["home", "about", "scoring"] as const) {
      expect(canAccess(page, false)).toBe(true);
    }
  });

  it("gates Forum, Predictions and Profile behind sign-in", () => {
    for (const page of ["forum", "predictions", "profile"] as const) {
      expect(canAccess(page, false)).toBe(false);
      expect(canAccess(page, true)).toBe(true);
    }
  });

  it("opens every page to a signed-in viewer", () => {
    for (const page of ALL_PAGES) {
      expect(canAccess(page, true)).toBe(true);
    }
  });
});

describe("the nav", () => {
  /**
   * The invariant that matters: the nav must never offer a link to a page the
   * viewer would be blocked from. The parent project asserts the same thing
   * because its nav and its access table are two separate lookups that can
   * drift apart.
   */
  it("never links somewhere the viewer can't go", () => {
    for (const isLoggedIn of [true, false]) {
      for (const link of navLinksFor(isLoggedIn)) {
        expect(
          canAccess(link.page, isLoggedIn),
          `${link.label} is linked but not accessible when isLoggedIn=${isLoggedIn}`
        ).toBe(true);
      }
    }
  });

  // Order follows the parent project's convention, which appends About last
  // in every link set — it is static reference content, so it sits after the
  // things a visitor actually came to do.
  it("shows Home, Scoring and About when signed out", () => {
    expect(navLinksFor(false).map((l) => l.label)).toEqual(["Home", "Scoring", "About"]);
  });

  it("inserts Forum after Home once signed in", () => {
    expect(navLinksFor(true).map((l) => l.label)).toEqual([
      "Home",
      "Forum",
      "Scoring",
      "About",
    ]);
  });

  it("keeps Predictions and Profile out of the nav in both states", () => {
    for (const isLoggedIn of [true, false]) {
      const pages = navLinksFor(isLoggedIn).map((l) => l.page);
      expect(pages).not.toContain("predictions");
      expect(pages).not.toContain("profile");
    }
  });
});
