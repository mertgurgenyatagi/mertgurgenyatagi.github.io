import { useEffect, useRef, useState } from 'react'
import {
  ref,
  onValue,
  onChildAdded,
  set,
  push,
  remove,
  update,
  onDisconnect,
  serverTimestamp,
} from 'firebase/database'
import { database, getAnonymousUid } from './firebase'
import type { Drafter, Pick } from './draftEngine'
import type { Message } from '../components/lobby/LobbyChat'
import type { DraftConfig } from '../routes/Draft'

export interface RoomState {
  host: string // uid
  status: 'lobby' | 'drafting' | 'complete'
  config: DraftConfig
  drafters: Record<string, Drafter & { online: boolean; offlineAt?: number }> // key is uid
  picks: Record<string, Omit<Pick, 'player'> & { playerId: string }>
  chat: Record<string, Message>
  auctionBlock?: any
  auctionSales?: any
  dondRound?: any
  dondPicks?: any
  spinState?: any
}

/**
 * How long a human seat may sit disconnected before a bot takes it over
 * *(R3-Q6, R4-Q3)*. Reconnecting hands control straight back *(R4-Q4)*.
 */
export const TAKEOVER_MS = 45000

export function useMultiplayerRoom(code: string | undefined) {
  const [room, setRoom] = useState<RoomState | null>(null)
  const [uid, setUid] = useState<string | null>(null)

  useEffect(() => {
    getAnonymousUid().then(setUid)
  }, [])

  useEffect(() => {
    if (!code) return
    const roomRef = ref(database, `rooms/${code}`)
    const unsub = onValue(roomRef, (snap) => {
      setRoom(snap.val() as RoomState | null)
    })
    return () => unsub()
  }, [code])

  // Maintain presence if we are in the room
  useEffect(() => {
    if (!code || !uid) return

    // We only want to set this up when we actually exist in the room
    const isMe = room?.drafters?.[uid]
    if (!isMe) return

    const meRef = ref(database, `rooms/${code}/drafters/${uid}`)

    /* Coming back clears the disconnect stamp as well as flipping the flag — a
       stale `offlineAt` left behind would have the host's takeover sweep read
       a reconnected seat as forty-five seconds gone. Handing control back on
       reconnect is the rule *(R4-Q4)*, so `kind` goes back to human even when
       a bot has already taken the seat over. */
    if (isMe.kind !== 'human' || !isMe.online || isMe.offlineAt) {
      update(meRef, { online: true, kind: 'human', offlineAt: null })
    }

    /* The disconnect writes *when* it happened, not only that it did. The
       host's sweep then reads an absolute deadline off the room itself rather
       than holding a timer inside a component that re-renders several times a
       second — see `useHostBotTakeover`. */
    const dcon = onDisconnect(meRef)
    dcon.update({ online: false, offlineAt: serverTimestamp() })

    return () => {
      dcon.cancel()
    }
  }, [
    code,
    uid,
    uid ? room?.drafters?.[uid]?.kind : undefined,
    uid ? room?.drafters?.[uid]?.online : undefined,
    uid ? room?.drafters?.[uid]?.offlineAt : undefined,
  ])

  return { room, uid }
}

/**
 * The host turns a dropped seat over to a bot after `TAKEOVER_MS`.
 *
 * **This used to hold a `setTimeout` per offline seat inside an effect keyed
 * on `room.drafters`** — which is a fresh object on every snapshot, and during
 * a draft the host pushes state several times a second, so the cleanup ran and
 * the forty-five seconds restarted from zero before they could ever elapse.
 * The takeover fired only if the room happened to go quiet, which is exactly
 * the "sometimes it does, sometimes it doesn't" it was reported as.
 *
 * It reads a deadline instead. `onDisconnect` stamps `offlineAt` on the seat,
 * so the sweep below is stateless: once a second, convert any human seat whose
 * stamp is more than `TAKEOVER_MS` old. Restarting the interval costs nothing,
 * a host reload does not reset anybody's clock, and a seat that reconnects
 * clears its own stamp.
 */
export function useHostBotTakeover(
  code: string | undefined,
  isHost: boolean,
  room: RoomState | null,
) {
  /* The sweep reads the newest room off a ref rather than out of its own
     closure, so the interval is created once per draft rather than once per
     snapshot. */
  const latest = useRef(room)
  latest.current = room

  const drafting = room?.status === 'drafting'

  useEffect(() => {
    if (!code || !isHost || !drafting) return

    const sweep = () => {
      const current = latest.current
      if (!current || current.status !== 'drafting') return

      for (const [id, drafter] of Object.entries(current.drafters || {})) {
        if (drafter.kind !== 'human') continue
        if (drafter.online !== false) continue

        /* A seat that dropped before `offlineAt` existed — or whose write has
           not landed yet — is stamped now rather than taken over on the spot.
           The forty-five seconds are the rule, and guessing at them would cut
           somebody's reconnect window short. */
        if (typeof drafter.offlineAt !== 'number') {
          update(ref(database, `rooms/${code}/drafters/${id}`), { offlineAt: Date.now() })
          continue
        }

        if (Date.now() - drafter.offlineAt < TAKEOVER_MS) continue

        update(ref(database, `rooms/${code}/drafters/${id}`), { kind: 'bot' })
        sendSystemMessage(code, `${drafter.name} dropped — a bot has taken the seat.`)
      }
    }

    const timer = window.setInterval(sweep, 1000)
    sweep()
    return () => window.clearInterval(timer)
  }, [code, isHost, drafting])
}

/**
 * A queue of client actions, drained by the host.
 *
 * `onChildAdded` replays every child already under the path the moment it
 * attaches, so a listener that only ever *read* the queue re-ran the whole
 * draft's worth of bids or box-opens every time it re-attached — which is one
 * of the ways a non-host could watch the auction reorder itself under them.
 * Each entry is removed as it is handled, which drains the queue and makes a
 * re-attachment a no-op; `seen` covers the window between handling a child and
 * its removal landing.
 */
export function useActionQueue(
  code: string | undefined,
  name: string,
  active: boolean,
  handler: (payload: any) => void,
) {
  const latest = useRef(handler)
  latest.current = handler

  useEffect(() => {
    if (!code || !active) return
    const seen = new Set<string>()
    const queue = ref(database, `rooms/${code}/${name}`)

    return onChildAdded(queue, (snapshot) => {
      if (!snapshot.key || seen.has(snapshot.key)) return
      seen.add(snapshot.key)
      const payload = snapshot.val()
      remove(snapshot.ref)
      if (payload) latest.current(payload)
    })
  }, [code, name, active])
}

export async function joinRoom(
  code: string,
  drafter: Drafter,
  isHost: boolean,
  config?: DraftConfig,
) {
  try {
    const uid = await getAnonymousUid()
    const roomRef = ref(database, `rooms/${code}`)

    // If host, we might be creating the room
    if (isHost && config) {
      await update(roomRef, {
        host: uid,
        status: 'lobby',
        config,
      })
    }

    // Set presence
    const meRef = ref(database, `rooms/${code}/drafters/${uid}`)
    await set(meRef, { ...drafter, online: true })
    onDisconnect(meRef).update({ online: false, offlineAt: serverTimestamp() })

    // Send a join message
    await sendSystemMessage(code, `${drafter.name} joined.`)
  } catch (error) {
    console.error('Failed to join room:', error)
  }
}

export async function setRoomStatus(code: string, status: 'drafting' | 'complete') {
  await update(ref(database, `rooms/${code}`), { status })
}

export async function updateRoomConfig(code: string, config: DraftConfig) {
  await update(ref(database, `rooms/${code}`), { config })
}

export async function sendChatMessage(code: string, author: string, body: string) {
  const chatRef = ref(database, `rooms/${code}/chat`)
  await push(chatRef, {
    kind: 'said',
    author,
    body,
    timestamp: serverTimestamp(),
  })
}

/** A room event rather than somebody talking — drawn as a rule of text. */
export async function sendSystemMessage(code: string, body: string) {
  const chatRef = ref(database, `rooms/${code}/chat`)
  await push(chatRef, {
    kind: 'system',
    author: '',
    body,
    timestamp: serverTimestamp(),
  })
}

export async function makePick(code: string, pick: Pick) {
  const picksRef = ref(database, `rooms/${code}/picks`)
  await push(picksRef, {
    overall: pick.overall,
    seat: pick.seat,
    slot: pick.slot,
    playerId: pick.player.id,
  })
}

export async function addBot(code: string, count: number) {
  const botId = `bot-${count}`
  const botRef = ref(database, `rooms/${code}/drafters/${botId}`)
  await set(botRef, {
    id: botId,
    name: `Bot ${count}`,
    kind: 'bot',
    mark: String(count),
    online: true,
  })
}

export async function removeBot(code: string, botId: string) {
  const botRef = ref(database, `rooms/${code}/drafters/${botId}`)
  await set(botRef, null)
}

export async function updateAuctionState(code: string, block: any, sales: any) {
  const roomRef = ref(database, `rooms/${code}`)
  await update(roomRef, {
    auctionBlock: block ?? null,
    auctionSales: sales ?? null,
  })
}

export async function placeAuctionBid(code: string, seat: number, step: number) {
  const bidsRef = ref(database, `rooms/${code}/auctionBids`)
  await push(bidsRef, { seat, step, timestamp: Date.now() })
}

/** A seat standing down from the lot. See the pass rule in `auctionEngine`. */
export async function placeAuctionPass(code: string, seat: number) {
  const bidsRef = ref(database, `rooms/${code}/auctionBids`)
  await push(bidsRef, { seat, pass: true, timestamp: Date.now() })
}

export async function updateDondState(code: string, round: any, picks: any) {
  const roomRef = ref(database, `rooms/${code}`)
  await update(roomRef, {
    dondRound: round ?? null,
    dondPicks: picks ?? null,
  })
}

export async function placeDondAction(code: string, seat: number, action: any) {
  const actionsRef = ref(database, `rooms/${code}/dondActions`)
  await push(actionsRef, { seat, action, timestamp: Date.now() })
}

export async function updateSpinState(code: string, spinState: any) {
  const roomRef = ref(database, `rooms/${code}`)
  await update(roomRef, {
    spinState: spinState ?? null,
  })
}

export async function placeSpinAction(code: string, seat: number, action: any) {
  const actionsRef = ref(database, `rooms/${code}/spinActions`)
  await push(actionsRef, { seat, action, timestamp: Date.now() })
}
