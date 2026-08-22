/**
 * Who you are in a given room, kept for the length of the tab.
 *
 * Not a store — one module, two keys, read by the one route that needs it. It
 * exists so a refresh on /#/lobby/KX7QD doesn't ask for your name again and
 * doesn't quietly demote the host to a guest.
 */
export interface LobbySession {
  name: string
  host: boolean
}

const roomKey = (code: string) => `fd.lobby.${code}`
const NAME_KEY = 'fd.name'

export function readSession(code: string): LobbySession | null {
  try {
    const raw = sessionStorage.getItem(roomKey(code))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<LobbySession>
    return parsed.name ? { name: parsed.name, host: Boolean(parsed.host) } : null
  } catch {
    return null
  }
}

export function writeSession(code: string, session: LobbySession): void {
  try {
    sessionStorage.setItem(roomKey(code), JSON.stringify(session))
    localStorage.setItem(NAME_KEY, session.name)
  } catch {
    /* Private mode, a blocked origin — the lobby works, it just forgets. */
  }
}

/** The last name used anywhere, so the gate opens pre-filled. */
export function readName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? ''
  } catch {
    return ''
  }
}
