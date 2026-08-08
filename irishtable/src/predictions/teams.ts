import { CLUBS, getClub, type Club } from "@/data/clubs";

/**
 * The shape the ported kupatakipucl components expect, mapped onto
 * irishtable's own club data.
 *
 * The parent keeps its 36 Champions League teams in `predictions/teams.ts` and
 * roughly fifteen cloned components import `TEAMS`, `TEAM_BY_ID` and
 * `teamCrestSrc` from that path. Rather than edit every one of them, this
 * module re-exports irishtable's `src/data/clubs.ts` under those names.
 *
 * `src/data/clubs.ts` stays the single source of truth. Nothing here adds
 * data; it only renames.
 *
 * One real difference worth knowing: the parent assigns crests to teams by
 * hashing the team id, so **every badge in kupatakipucl is deliberately on the
 * wrong club** pending a roster swap. irishtable's crests were supplied by Mert
 * and map to their real clubs, so `teamCrestSrc` is a straight lookup. That is
 * also why the mobile ranker here can show a crest grid where the parent had to
 * fall back to a text list.
 */

export type Team = Club;

export const TEAMS: readonly Club[] = CLUBS;

export const TEAM_BY_ID: Record<string, Club> = Object.fromEntries(
  CLUBS.map((club) => [club.id, club])
);

export function teamCrestSrc(teamId: string): string {
  return getClub(teamId)?.crest ?? "";
}

export function teamName(teamId: string): string {
  return getClub(teamId)?.name ?? teamId;
}
