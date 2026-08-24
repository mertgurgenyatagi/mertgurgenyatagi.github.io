import { useMemo } from 'react'
import type { Drafter } from './draftEngine'
import type { RoomState } from './multiplayer'

/**
 * Who is at the table, and which seat is yours.
 *
 * All four draft screens carried their own copy of this, and every copy had
 * the same two faults.
 *
 * **Seat order must not depend on `kind`.** Seat index is the key everything
 * in a draft is stored against — picks, sales, bids, box openings, whose turn
 * it is — so ordering is host first and then id ascending: nothing about it
 * can change while a draft is running, because neither a seat's id nor who
 * the host is ever does.
 *
 * **An unseated client is not seat 0.** `Math.max(0, findIndex(...))` returns
 * 0 when you are not in the room yet — which is the host's seat — so for the
 * render or two before your own drafter record arrives you were drawn as, and
 * could act as, the host. `youSeat` is `-1` until the room actually holds you;
 * `seated` is the flag a screen should wait on.
 */
export interface SeatTable {
  drafters: Drafter[]
  /** Your index in `drafters`, or -1 when the room does not hold you yet. */
  youSeat: number
  /** False while the room is still loading, or before you are in it. */
  seated: boolean
}

export function useSeats(
  baseDrafters: Drafter[],
  isMultiplayer: boolean,
  room: RoomState | null,
  uid: string | null,
): SeatTable {
  return useMemo(() => {
    if (!isMultiplayer || !room?.drafters) {
      const youSeat = baseDrafters.findIndex((drafter) => drafter.kind === 'you')
      return {
        drafters: baseDrafters,
        youSeat: youSeat < 0 ? 0 : youSeat,
        seated: true,
      }
    }

    const entries = Object.entries(room.drafters)

    /* Host first, then id ascending. Deterministic on every client and — the
       point of it — unaffected by a seat's `kind` changing under a takeover. */
    const ordered = entries.sort(([a], [b]) => {
      if (a === room.host) return -1
      if (b === room.host) return 1
      return a.localeCompare(b)
    })

    const drafters: Drafter[] = ordered.map(([id, drafter]) => ({
      id,
      kind: id === uid ? 'you' : 'human',
      name: drafter.name,
      mark: drafter.mark,
    }))

    const youSeat = uid ? ordered.findIndex(([id]) => id === uid) : -1

    return { drafters, youSeat, seated: youSeat >= 0 }
  }, [baseDrafters, isMultiplayer, room?.drafters, room?.host, uid])
}
