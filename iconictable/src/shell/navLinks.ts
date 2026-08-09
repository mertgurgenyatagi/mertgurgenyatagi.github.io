/**
 * Access control and the nav, in one table.
 *
 * kupatakipucl derives an eight-state `VisibilityState` from
 * `logged-in × four tournament phases` and keys its nav off that. irishtable
 * has one phase, so the entire model collapses to a single question: are you
 * signed in? The parent's structure is otherwise kept verbatim — two link
 * sets, About appended last in both, and a test asserting the nav never
 * offers a link the viewer would be blocked from.
 */

export type PageId = "home" | "about" | "scoring" | "forum" | "predictions" | "profile";

export interface NavLink {
  page: PageId;
  path: string;
  label: string;
}

/** Pages that need a signed-in viewer. */
export const REQUIRES_LOGIN: Record<PageId, boolean> = {
  home: false,
  about: false,
  scoring: false,
  forum: true,
  predictions: true,
  profile: true,
};

export function canAccess(page: PageId, isLoggedIn: boolean): boolean {
  return isLoggedIn || !REQUIRES_LOGIN[page];
}

/**
 * Predictions is reached from a contextual call to action on Home rather than
 * a nav link — it is a one-time door, and a permanent link to a door you have
 * already walked through is clutter. Profile lives in the account slot beside
 * the avatar, for the same reason. Both match the parent.
 */
const LOGGEDOUT_LINKS: NavLink[] = [
  { page: "home", path: "/", label: "Home" },
  { page: "scoring", path: "/scoring", label: "Scoring" },
  { page: "about", path: "/about", label: "About" },
];

const LOGGEDIN_LINKS: NavLink[] = [
  { page: "home", path: "/", label: "Home" },
  { page: "forum", path: "/forum", label: "Forum" },
  { page: "scoring", path: "/scoring", label: "Scoring" },
  { page: "about", path: "/about", label: "About" },
];

/** The single table both shells read. */
export const NAV_LINKS: Record<"loggedout" | "loggedin", NavLink[]> = {
  loggedout: LOGGEDOUT_LINKS,
  loggedin: LOGGEDIN_LINKS,
};

export function navLinksFor(isLoggedIn: boolean): NavLink[] {
  return NAV_LINKS[isLoggedIn ? "loggedin" : "loggedout"];
}

/** Shown by any page whose gate fails. Centralised from the start — the
 *  parent duplicated this literal across six files before it was pulled out. */
export const BLOCKED_MESSAGE = "You need to be signed in to see this.";
