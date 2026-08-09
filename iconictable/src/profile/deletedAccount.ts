/**
 * A uid with no matching entry in the currently-loaded players list means the
 * account behind it was deleted — deleting a profile wipes `profiles/{uid}`,
 * but the chat messages, forum posts, likes and mentions that uid made are
 * left in place. Every surface that looks up an author by uid renders these
 * the same way, rather than leaking a raw Firebase uid or a generic
 * "Unknown" that reads like a bug.
 *
 * Cloned from kupatakipucl, which arrived at one shared copy after seven
 * duplicated inline `initials()` functions all assumed a name field was
 * always a real string and crashed on `undefined.charAt(0)`.
 *
 * The parent's first + last name split is collapsed to one `displayName`
 * here, so `fullName` and `firstNameOnly` are the same function. Both names
 * are kept because ported components call both.
 */
export const DELETED_ACCOUNT_LABEL = "Deleted";
export const DELETED_ACCOUNT_AVATAR = "/brand/iconictable-logo.svg";

interface NamedPlayer {
  displayName: string;
}

export function fullName(player: NamedPlayer | null | undefined): string {
  const name = player?.displayName?.trim();
  return name ? name : DELETED_ACCOUNT_LABEL;
}

/** irishtable has one name field, so this is `fullName`. Kept as its own
 *  export because ported components distinguish the two. */
export function firstNameOnly(player: NamedPlayer | null | undefined): string {
  return fullName(player);
}

export function initials(player: NamedPlayer | null | undefined): string {
  const name = player?.displayName?.trim();
  if (!name) return "?";
  return name.charAt(0).toUpperCase();
}

export function avatarSrc(
  player: { photoURL: string } | null | undefined
): string {
  return player?.photoURL ? player.photoURL : DELETED_ACCOUNT_AVATAR;
}

/** True when a uid resolved to nothing — the caller usually wants to style
 *  the row differently as well as label it. */
export function isDeleted(player: NamedPlayer | null | undefined): boolean {
  return !player?.displayName?.trim();
}
