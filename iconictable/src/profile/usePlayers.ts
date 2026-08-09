/**
 * The participant list, and the `Player` name ported components import.
 *
 * The hook itself lives in `useProfile.ts` alongside the single-document
 * listener it shares a converter with. This module exists so the ~15 files
 * cloned from kupatakipucl — which all `import type { Player } from
 * "../profile/usePlayers"` — resolve without being edited.
 *
 * `Player` is `Profile`. The parent distinguishes the two because a
 * logged-out visitor there reads a reduced `publicProfiles` shape with no
 * surname; irishtable has one `displayName` and no privacy split, so there is
 * only ever one shape.
 */
export { usePlayers } from "./useProfile";
export type { Profile as Player } from "./profileTypes";
