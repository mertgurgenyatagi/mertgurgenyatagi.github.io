/**
 * A participant's public identity.
 *
 * Deliberately a single `displayName` rather than the parent project's locked
 * first + last name. That split forced the parent into a whole second
 * `publicProfiles` collection so surnames wouldn't leak to logged-out
 * visitors; irishtable's audience is a public one, which makes surname
 * exposure worse, and nothing here needs a legal name. One field, editable,
 * no privacy split.
 */
export type Profile = {
  uid: string;
  displayName: string;
  photoURL: string;
  createdAt: number;
};

export const DISPLAY_NAME_MAX = 20;

/** Server rules enforce the same bounds — keep them in step. */
export function isValidDisplayName(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= DISPLAY_NAME_MAX;
}

/** Someone who deleted their account still owns old chat and forum messages,
 *  so every author lookup has to resolve a uid that no longer exists. */
export const DELETED_ACCOUNT_NAME = "Deleted account";

export function displayNameFor(profile: Profile | undefined | null): string {
  return profile?.displayName?.trim() || DELETED_ACCOUNT_NAME;
}
