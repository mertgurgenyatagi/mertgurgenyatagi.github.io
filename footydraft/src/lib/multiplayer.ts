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

  return { room, uid }
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

