import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ChipGroup, Collapse } from '../components/lobby/ChipGroup'
import { LobbyChat, type Message } from '../components/lobby/LobbyChat'
import { LobbyLayout } from '../components/lobby/LobbyLayout'
import { NameGate } from '../components/lobby/NameGate'
import { RoomCode } from '../components/lobby/RoomCode'
import { ScopeDetail } from '../components/lobby/ScopeDetail'
import { SeatList, type Seat } from '../components/lobby/SeatList'
import { BackHome } from '../components/ui/BackHome'
import { Button } from '../components/ui/Button'
import { formats } from '../data/formats'
import { MAX_SEATS, MIN_SEATS, constraints, scopes, timers } from '../data/lobbyOptions'
import { normaliseRoomCode } from '../lib/roomCode'
import { readSession, writeSession, type LobbySession } from '../lib/lobbySession'
import { useMultiplayerRoom, joinRoom, updateRoomConfig, setRoomStatus, sendChatMessage, addBot, removeBot } from '../lib/multiplayer'
import type { DraftConfig } from '../routes/Draft'
import {
  effectiveSize,
  hasDimmedOptions,
  isConfigViable,
  isConstraintAvailable,
  isFormatAvailable,
  isLeagueAvailable,
  isScopeAvailable,
  scopeKeyOf,
  seatsPhrase,
  unavailableReason,
} from '../lib/draftViability'

/** The space above a settings group, applied inside it so it collapses with it. */
const GROUP_GAP = 'pt-[var(--lobby-gap)]'

const initialOf = (name: string) => name.trim().charAt(0).toUpperCase() || '?'

/**
 * The friends lobby. Same diptych as the single-player one — who is playing on
 * the left, what they're playing on the right — with the three things a room
 * full of people needs and a room full of bots doesn't: the code that gets it
 * shared, a chat, and a host who owns the settings everyone else is only
 * shown.
 *
 * Nothing asks for your name until the last possible moment: the gate opens
 * over the lobby, and the lobby itself doesn't mount until it's answered. A
 * pasted invite link therefore behaves exactly like clicking Create at home.
 */
export function MultiLobby() {
  const { code: raw = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()

  const code = normaliseRoomCode(raw)
  const arrived = location.state as Partial<LobbySession> | null

  const [session, setSession] = useState<LobbySession | null>(() => {
    if (arrived?.name) return { name: arrived.name, host: Boolean(arrived.host) }
    return code ? readSession(code) : null
  })

  useEffect(() => {
    if (code && session) writeSession(code, session)
  }, [code, session])

  if (!code) return <Navigate to="/" replace />

  if (!session) {
    return (
      <div className="lobby relative h-full overflow-hidden">
        <NameGate
          mode="join"
          code={code}
          onSubmit={(name) => setSession({ name, host: false })}
          onCancel={() => navigate('/')}
        />
      </div>
    )
  }

  return <Room key={code} code={code} session={session} />
}

function Room({ code, session }: { code: string; session: LobbySession }) {
  const navigate = useNavigate()
  const { room, uid } = useMultiplayerRoom(code)

  useEffect(() => {
    if (!uid) return
    const isHost = session.host
    const defaultConfig: DraftConfig = {
      scope: 'top-5',
      league: 'premier-league',
      constraint: 'club-1',
      timer: '15'
    }
    // We pass format null initially, host selects it
    joinRoom(
      code,
      { id: uid, name: session.name, kind: 'human', mark: initialOf(session.name) },
      isHost,
      isHost ? defaultConfig : undefined
    )
  }, [uid, code, session])

  useEffect(() => {
    if (room?.status === 'drafting' && room.config) {
      navigate(`/draft/${room.config.format || 'free-pick'}`, {
        state: { ...room.config, roomId: code },
        replace: true
      })
    }
  }, [room?.status, room?.config, navigate, code])

  // Derive UI state from room
  const config = room?.config || {}
  const format = config.format || null
  const scope = config.scope || 'top-5'
  const league = config.league || 'premier-league'
  const constraint = config.constraint || 'club-1'
  const timer = config.timer || '15'

  const hostUid = room?.host || uid
  const hostName = (hostUid && room?.drafters?.[hostUid]?.name) || 'The host'

  const messages = room?.chat ? Object.values(room.chat).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)) : []

  // Extract seats from drafters
  const seats: Seat[] = []
  if (room?.drafters) {
    const drafterEntries = Object.entries(room.drafters)
    // Host first
    const hostEntry = drafterEntries.find(([id]) => id === room.host)
    if (hostEntry) {
      seats.push({
        id: hostEntry[0],
        kind: hostEntry[1].kind as any,
        name: hostEntry[1].name,
        mark: hostEntry[1].mark,
        note: 'Host — sets the draft on the right',
        tag: hostUid === uid ? 'You (Host)' : 'Host'
      })
    }
    // Others
    drafterEntries.forEach(([id, d]) => {
      if (id === room.host) return
      seats.push({
        id,
        kind: d.kind as any,
        name: d.name,
        mark: d.mark,
        note: d.online ? 'At the table' : 'Offline',
        tag: id === uid ? 'You' : undefined
      })
    })
  }

  const setConfig = (updates: Partial<DraftConfig>) => {
    if (session.host && room) {
      updateRoomConfig(code, { ...room.config, ...updates })
    }
  }

  const setFormat = (f: string) => setConfig({ format: f })
  const setScope = (s: string) => setConfig({ scope: s })
  const setLeague = (l: string) => setConfig({ league: l })
  const setConstraint = (c: string) => setConfig({ constraint: c })
  const setTimer = (t: string) => setConfig({ timer: t })

  const say = (body: string) => {
    if (uid) sendChatMessage(code, session.name, body)
  }

  /** Constraints exist for Free Pick and are not offered anywhere else. */
  const takesConstraint = format === 'free-pick'
  /** A bid timer exists for the Auction, and is not offered anywhere else. */
  const takesTimer = format === 'auction'
  const enoughSeats = seats.length >= MIN_SEATS

  /**
   * How many drafters the settings have to seat. People arrive on their own
   * here, so a draft that was playable a moment ago can stop being playable
   * when someone sits down — the panel re-reads itself as the table fills.
   */
  const size = effectiveSize(seats.length)
  const key = scopeKeyOf(scope, league)
  const seatsHint = seatsPhrase(size)

  const viable = isConfigViable(format, scope, league, constraint, size)
  const reason = unavailableReason(format, scope, league, constraint, size)
  const dimmed = hasDimmedOptions(format, scope, league, size)

  const canStart = session.host && enoughSeats && viable

  const resting = session.host
    ? !format
      ? 'Pick a format to start.'
      : !enoughSeats
        ? 'Two at the table to start — invite someone, or add a bot.'
        : reason
          ? reason
          : dimmed
            ? `Dimmed options don’t support ${seatsHint}.`
            : ''
    : `Only ${hostName} can change the draft or start it.`

  return (
    <LobbyLayout
      leftHeadingId="room-heading"
      seatCountLabel={`${seats.length} / ${MAX_SEATS} seats`}
      seatCountKey={seats.length}
      leftHeaderContent={
        <>
          <h1 id="room-heading" className="sr-only">
            Lobby {code}
          </h1>
          <RoomCode code={code} />
        </>
      }
      seatList={
        <SeatList
          seats={seats}
          minSeats={1}
          onAdd={
            session.host
              ? () => {
                  const currentBots = seats.filter(s => s.kind === 'bot').length
                  addBot(code, currentBots + 1)
                }
              : undefined
          }
          onRemove={
            session.host
              ? (id) => removeBot(code, id)
              : undefined
          }
        />
      }
      leftFooterContent={
        <LobbyChat
          you={session.name}
          messages={messages as Message[]}
          onSend={say}
        />
      }
      settingsContent={
        <>
          <ChipGroup
            label="Format"
            options={formats}
            value={format}
            onChange={setFormat}
            readOnly={!session.host}
            isUnavailable={(id) => !isFormatAvailable(id, size)}
            unavailableHint={seatsHint}
            delayMs={260}
          />

          <div className={GROUP_GAP}>
            <ChipGroup
              label="Scope"
              options={scopes}
              value={scope}
              onChange={setScope}
              readOnly={!session.host}
              isUnavailable={(id) => !isScopeAvailable(format, id, size)}
              unavailableHint={seatsHint}
              delayMs={340}
            >
              <ScopeDetail
                scope={scope}
                league={league}
                onLeagueChange={setLeague}
                readOnly={!session.host}
                isLeagueUnavailable={(id) => !isLeagueAvailable(format, id, size)}
                unavailableHint={seatsHint}
              />
            </ChipGroup>
          </div>

          <Collapse open={takesConstraint}>
            <div className={GROUP_GAP}>
              <ChipGroup
                label="Constraint"
                options={constraints}
                value={constraint}
                onChange={setConstraint}
                readOnly={!session.host}
                isUnavailable={(id) => !isConstraintAvailable(format, key, id, size)}
                unavailableHint={seatsHint}
                note="One per draft — constraints don't stack."
                delayMs={420}
              />
            </div>
          </Collapse>

          {/* Auction only — see the note on `timers` in lobbyOptions. */}
          <Collapse open={takesTimer}>
            <div className={GROUP_GAP}>
              <ChipGroup
                label="Bid timer"
                options={timers}
                value={timer}
                onChange={setTimer}
                readOnly={!session.host}
                note="How long a lot can sit without a bid. Any bid sends it back to full."
                delayMs={500}
              />
            </div>
          </Collapse>
        </>
      }
      statusMessage={resting}
      statusKey={resting}
      backControl={<BackHome label="Leave lobby" />}
      actionControl={
        <Button
          variant="accent"
          disabled={!canStart}
          onClick={() => {
            if (format) setRoomStatus(code, 'drafting')
          }}
        >
          {session.host ? 'Kick off →' : 'Waiting for the host'}
        </Button>
      }
    />
  )
}
