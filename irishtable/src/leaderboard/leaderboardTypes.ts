/**
 * One participant's entry, as the popups read it.
 *
 * The parent computes these server-side into a `leaderboardCache` document and
 * the whole league phase hangs off them. irishtable has no leaderboard and no
 * scoring engine, so nothing produces a populated entry yet — every call site
 * passes an empty array, and every widget that would render one is gated on
 * `tournamentStarted`, which is permanently false here.
 *
 * The type exists anyway because the ported popups are typed against it, and
 * because it is the shape a future league phase would fill. Keeping it honest
 * now costs nothing and saves a migration later.
 */
export interface LeaderboardEntry {
  uid: string;
  /** irishtable collects one display name, not the parent's first + last. */
  displayName: string;
  photoURL: string;
  points: number;
  /** The participant's predicted table: 20 club ids, first to twentieth. */
  ranking: string[];
  submittedAt?: number;
}
