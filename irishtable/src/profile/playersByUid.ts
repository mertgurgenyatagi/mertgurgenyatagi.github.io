import type { Player } from "./usePlayers";

/**
 * ChatRoom, Forum and RecentPostsPreview each built their own identical
 * `new Map(players.map((p) => [p.uid, p]))` from the same array in the parent
 * project. One shared builder instead of three copies of the same one-liner.
 */
export function buildPlayersByUid(players: Player[]): Map<string, Player> {
  return new Map(players.map((p) => [p.uid, p]));
}
