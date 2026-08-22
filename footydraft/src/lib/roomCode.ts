/**
 * Room codes. Read aloud and typed by hand, so the alphabet drops the four
 * characters that get confused when they are — I, O, 0 and 1.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** Long enough that two lobbies open in the same evening won't collide. */
export const CODE_LENGTH = 5

/** The shortest thing the join field will accept. */
export const CODE_MIN = 4

export function makeRoomCode(): string {
  const bytes = new Uint32Array(CODE_LENGTH)

  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < CODE_LENGTH; i += 1) bytes[i] = Math.floor(Math.random() * 0xffffffff)
  }

  let code = ''
  for (let i = 0; i < CODE_LENGTH; i += 1) code += ALPHABET[bytes[i] % ALPHABET.length]
  return code
}

/** Whatever was typed or pasted, reduced to something the router can carry. */
export function normaliseRoomCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, '').slice(0, 8)
}

export function isRoomCode(raw: string): boolean {
  return normaliseRoomCode(raw).length >= CODE_MIN
}

/**
 * A stable number for a code, so a given room always opens on the same draft
 * settings. Two people typing the same code see the same lobby.
 */
export function codeSeed(code: string): number {
  let seed = 0
  for (let i = 0; i < code.length; i += 1) seed = (seed * 31 + code.charCodeAt(i)) >>> 0
  return seed
}
