import { useEffect, useState } from 'react'
import type { RoomState } from '../lib/multiplayer'

/**
 * An in-memory stand-in for the Realtime Database, for the lobby and draft
 * tests.
 *
 * The multiplayer wiring landed without any test double for Firebase, so every
 * test that mounted a room-backed screen fell through to a real network client
 * that never resolves under jsdom — `room` stayed null, the lobby rendered
 * zero seats, and the assertions failed for a reason that had nothing to do
 * with what they were testing. This is small enough to keep honest: one room,
 * one subscriber list, the same shapes `useMultiplayerRoom` returns.
 */
const rooms = new Map<string, RoomState>()
const listeners = new Map<string, Set<() => void>>()

export const FAKE_UID = 'test-uid'

export function resetFakeRooms() {
  rooms.clear()
  listeners.clear()
}

function emit(code: string) {
  for (const listener of listeners.get(code) ?? []) listener()
}

function roomOf(code: string): RoomState {
  let room = rooms.get(code)
  if (!room) {
    room = {
      host: '',
      status: 'lobby',
      config: {},
      drafters: {},
      picks: {},
      chat: {},
    }
    rooms.set(code, room)
  }
  return room
}

function write(code: string, mutate: (room: RoomState) => void) {
  const room = { ...roomOf(code) }
  mutate(room)
  rooms.set(code, room)
  emit(code)
}

export function useMultiplayerRoom(code: string | undefined) {
  const [, bump] = useState(0)

  useEffect(() => {
    if (!code) return
    const listener = () => bump((n) => n + 1)
    const set = listeners.get(code) ?? new Set()
    set.add(listener)
    listeners.set(code, set)
    return () => {
      set.delete(listener)
    }
  }, [code])

  return { room: code ? (rooms.get(code) ?? null) : null, uid: FAKE_UID }
}

export function useHostBotTakeover() {}
export function useActionQueue() {}

export async function joinRoom(
  code: string,
  drafter: { id: string; name: string; kind: string; mark: string },
  isHost: boolean,
  config?: Record<string, unknown>,
) {
  write(code, (room) => {
    if (isHost && config) {
      room.host = FAKE_UID
      room.status = 'lobby'
      room.config = config
    }
    room.drafters = { ...room.drafters, [FAKE_UID]: { ...drafter, online: true } as never }
    room.chat = {
      ...room.chat,
      [`join-${FAKE_UID}`]: {
        id: 0,
        kind: 'system',
        author: '',
        body: `${drafter.name} joined.`,
        timestamp: Date.now(),
      },
    }
  })
}

export async function setRoomStatus(code: string, status: RoomState['status']) {
  write(code, (room) => {
    room.status = status
  })
}

export async function updateRoomConfig(code: string, config: RoomState['config']) {
  write(code, (room) => {
    room.config = config
  })
}

let chatSeq = 0

export async function sendChatMessage(code: string, author: string, body: string) {
  write(code, (room) => {
    chatSeq += 1
    room.chat = {
      ...room.chat,
      [`m${chatSeq}`]: { id: chatSeq, kind: 'said', author, body, timestamp: Date.now() },
    }
  })
}

export async function sendSystemMessage(code: string, body: string) {
  write(code, (room) => {
    chatSeq += 1
    room.chat = {
      ...room.chat,
      [`m${chatSeq}`]: { id: chatSeq, kind: 'system', author: '', body, timestamp: Date.now() },
    }
  })
}

export async function addBot(code: string, count: number) {
  write(code, (room) => {
    const id = `bot-${count}`
    room.drafters = {
      ...room.drafters,
      [id]: { id, name: `Bot ${count}`, kind: 'bot', mark: String(count), online: true } as never,
    }
  })
}

export async function removeBot(code: string, botId: string) {
  write(code, (room) => {
    const next = { ...room.drafters }
    delete next[botId]
    room.drafters = next
  })
}

export async function makePick() {}
export async function updateAuctionState() {}
export async function placeAuctionBid() {}
export async function placeAuctionPass() {}
export async function updateDondState() {}
export async function placeDondAction() {}
export async function updateSpinState() {}
export async function placeSpinAction() {}
export const TAKEOVER_MS = 45000
