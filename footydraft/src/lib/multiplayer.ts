import { useEffect, useState } from 'react'
import {
  ref,
  onValue,
  set,
  push,
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
  drafters: Record<string, Drafter & { online: boolean }> // key is uid
  picks: Record<string, Omit<Pick, 'player'> & { playerId: string }>
  chat: Record<string, Message>
  auctionBlock?: any
  auctionSales?: any
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
    if (!code || !uid || !room?.drafters?.[uid]) return
    const meRef = ref(database, `rooms/${code}/drafters/${uid}`)
    
    // Set online and switch kind back to human in case bot had taken over
    update(meRef, { online: true, kind: 'human' })
    
    const dcon = onDisconnect(meRef)
    dcon.update({ online: false })
    
    return () => {
      dcon.cancel()
    }
  }, [code, uid, uid ? room?.drafters?.[uid] != null : false])

  return { room, uid }
}

export function useHostBotTakeover(code: string | undefined, isHost: boolean, room: RoomState | null) {
  useEffect(() => {
    if (!code || !isHost || !room || room.status !== 'drafting') return
    
    const timers: Record<string, number> = {}
    
    for (const [id, drafter] of Object.entries(room.drafters || {})) {
      if (drafter.kind === 'human' && drafter.online === false) {
        timers[id] = window.setTimeout(() => {
          const dRef = ref(database, `rooms/${code}/drafters/${id}`)
          update(dRef, { kind: 'bot' })
          sendChatMessage(code, '', `${drafter.name} disconnected. A bot has taken over.`)
        }, 45000)
      }
    }
    
    return () => {
      for (const t of Object.values(timers)) {
        window.clearTimeout(t)
      }
    }
  }, [code, isHost, room?.drafters, room?.status])
}

export async function joinRoom(
  code: string,
  drafter: Drafter,
  isHost: boolean,
  config?: DraftConfig
) {
  const uid = await getAnonymousUid()
  const roomRef = ref(database, `rooms/${code}`)
  
  // If host, we might be creating the room
  if (isHost && config) {
    // We only want to set this if it doesn't exist, but for now we just set it
    // because the host creates it. In a real app we'd use a transaction.
    // For Tachyon, simple set/update is fine.
    await update(roomRef, {
      host: uid,
      status: 'lobby',
      config,
    })
  }

  // Set presence
  const meRef = ref(database, `rooms/${code}/drafters/${uid}`)
  await set(meRef, { ...drafter, online: true })
  onDisconnect(meRef).update({ online: false })

  // Send a join message
  const chatRef = ref(database, `rooms/${code}/chat`)
  await push(chatRef, {
    kind: 'system',
    author: '',
    body: `${drafter.name} joined.`,
    timestamp: serverTimestamp()
  })
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
    timestamp: serverTimestamp()
  })
}

export async function makePick(
  code: string,
  pick: Pick
) {
  const picksRef = ref(database, `rooms/${code}/picks`)
  await push(picksRef, {
    overall: pick.overall,
    seat: pick.seat,
    slot: pick.slot,
    playerId: pick.player.id
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
    online: true
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
    auctionSales: sales ?? null
  })
}

export async function placeAuctionBid(code: string, seat: number, step: number) {
  const bidsRef = ref(database, `rooms/${code}/auctionBids`)
  await push(bidsRef, { seat, step, timestamp: Date.now() })
}

