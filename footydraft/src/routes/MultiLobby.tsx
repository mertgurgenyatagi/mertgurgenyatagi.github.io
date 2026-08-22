import { useEffect, useRef, useState } from 'react'
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
import { MAX_SEATS, MIN_SEATS, constraints, leagues, scopes, timers } from '../data/lobbyOptions'
import { CHATTER_DELAY, arrivalDelays, arrivalLines, people, type Person } from '../data/lobbyPeople'
import { codeSeed, normaliseRoomCode } from '../lib/roomCode'
import { readSession, writeSession, type LobbySession } from '../lib/lobbySession'
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
  /** What the host of this particular room settled on. The same code always
   *  opens the same draft, so two people typing it in see one lobby. */
  const seed = codeSeed(code)
  const hostName = people[0].name

  const [humans, setHumans] = useState<(Person & { host?: boolean })[]>(() =>
    session.host ? [] : [{ ...people[0], host: true }],
  )

  /** Ids rather than a count, so adding a seat animates only the row that arrived. */
  const nextBotId = useRef(1)
  const [bots, setBots] = useState<number[]>([])

  const [format, setFormat] = useState<string | null>(() =>
    session.host ? null : formats[seed % formats.length].id,
  )
  const [scope, setScope] = useState(() =>
    session.host ? 'top-5' : scopes[(seed >> 3) % scopes.length].id,
  )
  const [league, setLeague] = useState(() =>
    session.host ? 'premier-league' : leagues[(seed >> 6) % leagues.length].id,
  )
  const [constraint, setConstraint] = useState(() =>
    session.host ? 'club-1' : constraints[(seed >> 12) % constraints.length].id,
  )
  const [timer, setTimer] = useState(() =>
    session.host ? '15' : timers[(seed >> 15) % timers.length].id,
  )

  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: 0,
      kind: 'system',
      author: '',
      body: session.host ? 'Lobby opened — share the code.' : `${hostName} opened the lobby.`,
    },
  ])


  const nextMessageId = useRef(1)
  const say = (message: Omit<Message, 'id'>) => {
    const id = nextMessageId.current
    nextMessageId.current += 1
    setMessages((current) => [...current, { ...message, id }])
  }

  // Read by the arrival timers below, which fire outside a render and so can't
  // see the state directly.
  const occupancy = useRef({ humans: humans.length, bots: 0 })
  useEffect(() => {
    occupancy.current = { humans: humans.length, bots: bots.length }
  }, [humans, bots])

  /**
   * People turn up. There's no server behind this yet, so the lobby plays the
   * arrivals itself — on a stagger, taking real seats, stopping the moment the
   * table is full.
   */
  useEffect(() => {
    const waiting = people.filter((person) => !humans.some((entry) => entry.id === person.id))
    const pending: number[] = []

    waiting.slice(0, arrivalDelays.length).forEach((person, index) => {
      pending.push(
        window.setTimeout(() => {
          const { humans: seated, bots: botCount } = occupancy.current
          if (1 + seated + botCount >= MAX_SEATS) return

          setHumans((current) => [...current, person])
          say({ kind: 'system', author: '', body: `${person.name} joined.` })

          pending.push(
            window.setTimeout(() => {
              say({
                kind: 'said',
                author: person.name,
                body: arrivalLines[index % arrivalLines.length],
              })
            }, CHATTER_DELAY),
          )
        }, arrivalDelays[index]),
      )
    })

    return () => pending.forEach((id) => window.clearTimeout(id))
    // Runs once for the room: the schedule is the room's, not a reaction to it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const you: Seat = {
    id: 'you',
    kind: 'you',
    name: session.name,
    mark: initialOf(session.name),
    note: session.host ? 'Host — sets the draft on the right' : 'At the table',
    tag: session.host ? 'Host' : 'You',
  }

  const humanSeats: Seat[] = humans.map((person) => ({
    id: person.id,
    kind: 'human' as const,
    name: person.name,
    mark: initialOf(person.name),
    note: person.host ? 'Host — sets the draft on the right' : 'At the table',
    tag: person.host ? 'Host' : undefined,
  }))

  const botSeats: Seat[] = bots.map((id, index) => ({
    id: String(id),
    kind: 'bot' as const,
    name: `Bot ${index + 1}`,
    mark: String(index + 1),
    note: 'Default style',
  }))

  // The host sits first because they opened the room; everyone else is in the
  // order they walked in.
  const seats: Seat[] = session.host
    ? [you, ...humanSeats, ...botSeats]
    : [...humanSeats.filter((seat) => seat.tag === 'Host'), you,
       ...humanSeats.filter((seat) => seat.tag !== 'Host'), ...botSeats]

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
                  const id = nextBotId.current
                  nextBotId.current += 1
                  setBots((current) => [...current, id])
                }
              : undefined
          }
          onRemove={
            session.host
              ? (id) => setBots((current) => current.filter((entry) => String(entry) !== id))
              : undefined
          }
        />
      }
      leftFooterContent={
        <LobbyChat
          you={session.name}
          messages={messages}
          onSend={(body) => say({ kind: 'said', author: session.name, body })}
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
            if (!format) return
            navigate(`/draft/${format}`, {
              state: {
                scope,
                league,
                constraint,
                timer,
                drafters: seats.map(({ id, kind, name, mark }) => ({ id, kind, name, mark })),
              },
            })
          }}
        >
          {session.host ? 'Kick off →' : 'Waiting for the host'}
        </Button>
      }
    />
  )
}
