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

    /* Coming back clears the disconnect stamp as well as flipping the flag. */
    if (isMe.kind !== 'human' || !isMe.online || isMe.offlineAt) {
      update(meRef, { online: true, kind: 'human', offlineAt: null })
    }

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
