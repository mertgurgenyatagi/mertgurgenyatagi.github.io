import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChipGroup, Collapse } from '../components/lobby/ChipGroup'
import { LobbyChat, type Message } from '../components/lobby/LobbyChat'
import { LobbyLayout } from '../components/lobby/LobbyLayout'
import { ScopeDetail } from '../components/lobby/ScopeDetail'
import { SeatList, type Seat } from '../components/lobby/SeatList'
import { BackHome } from '../components/ui/BackHome'
import { Button } from '../components/ui/Button'
import { formats } from '../data/formats'
import { MAX_SEATS, constraints, scopes, timers } from '../data/lobbyOptions'
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

/**
 * The single-player lobby — a hard diptych. Who is playing on the left, on a
 * surface step; what they're playing on the right, on the ground. The step is
 * the division; there is no rule between them.
 *
 * Format is carried in on the URL from whichever tile was clicked at home.
 * Landing here without one leaves every format unpicked rather than defaulting
 * to any of them — the four are equals.
 *
 * Kicking off opens the draft on exactly this table: the scope, the league,
 * the constraint, the bid timer and the seat list all travel over as router
 * state, so the draft starts on the configuration in front of you.
 */
export function SoloLobby() {
  const { formatId } = useParams()

  // Keyed on the format so arriving at a *different* one — a second tile, a
  // pasted link — rebuilds the screen. Without it React reuses the instance
  // and the seeded state below never re-runs.
  return <ReadyRoom key={formatId ?? 'none'} formatId={formatId} />
}

function ReadyRoom({ formatId }: { formatId?: string }) {
  const navigate = useNavigate()
  const [format, setFormat] = useState<string | null>(() =>
    formats.some((entry) => entry.id === formatId) ? (formatId as string) : null,
  )
  const [scope, setScope] = useState('top-5')
  const [league, setLeague] = useState('premier-league')
  const [constraint, setConstraint] = useState('club-1')
  const [timer, setTimer] = useState('15')

  /** Ids rather than a count, so adding a seat animates only the row that arrived. */
  const nextBotId = useRef(4)
  const [bots, setBots] = useState<number[]>([1, 2, 3])

  /* Chat is live here too. There is nobody else in a solo lobby to talk to yet,
     which is exactly why the table's own events go through it — a room that
     says what has happened in it is a room, and an empty panel is furniture. */
  const messageId = useRef(1)
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, kind: 'system', author: '', body: 'Table opened — three bots seated.' },
  ])
  const say = (message: Omit<Message, 'id'>) =>
    setMessages((current) => [...current, { ...message, id: messageId.current++ }])

  const seats: Seat[] = [
    {
      id: 'you',
      kind: 'you',
      name: 'You',
      mark: 'Y',
      note: 'Host — sets the draft on the right',
      tag: 'Seat 1',
    },
    ...bots.map((id, index) => ({
      id: String(id),
      kind: 'bot' as const,
      name: `Bot ${index + 1}`,
      mark: String(index + 1),
      note: 'Default style',
    })),
  ]

  /** Constraints exist for Free Pick and are not offered anywhere else. */
  const takesConstraint = format === 'free-pick'
  /** A bid timer exists for the Auction, and is not offered anywhere else. */
  const takesTimer = format === 'auction'

  /**
   * How many drafters the settings have to seat. Every option below is
   * measured against this, so adding or removing a bot re-reads the panel.
   */
  const size = effectiveSize(seats.length)
  const key = scopeKeyOf(scope, league)
  const seatsHint = seatsPhrase(size)

  const viable = isConfigViable(format, scope, league, constraint, size)
  const reason = unavailableReason(format, scope, league, constraint, size)
  const dimmed = hasDimmedOptions(format, scope, league, size)

  const resting = !format
    ? 'Pick a format to start.'
    : reason
      ? reason
      : dimmed
        ? `Dimmed options don’t support ${seatsHint}.`
        : ''

  return (
    <LobbyLayout
      leftHeadingId="table-heading"
      seatCountLabel={`${seats.length} / ${MAX_SEATS} seats`}
      seatCountKey={seats.length}
      leftHeaderContent={
        <h1
          id="table-heading"
          className="fx fx-soft mt-[clamp(0.4rem,1.6vh,1rem)] hidden font-display text-[clamp(1.6rem,3.4vw,2.75rem)] font-bold uppercase leading-[0.95] tracking-[0.02em] md:block"
          style={{ animationDelay: '140ms' }}
        >
          Your table
        </h1>
      }
      seatList={
        <SeatList
          seats={seats}
          onAdd={() => {
            const id = nextBotId.current
            nextBotId.current += 1
            setBots((current) => [...current, id])
            say({ kind: 'system', author: '', body: `Bot ${bots.length + 1} seated.` })
          }}
          onRemove={(id) => {
            setBots((current) => current.filter((entry) => String(entry) !== id))
            say({ kind: 'system', author: '', body: 'A bot left the table.' })
          }}
        />
      }
      leftFooterContent={
        <LobbyChat
          you="You"
          messages={messages}
          onSend={(body) => say({ kind: 'said', author: 'You', body })}
        />
      }
      settingsContent={
        <>
          <ChipGroup
            label="Format"
            options={formats}
            value={format}
            onChange={setFormat}
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
              isUnavailable={(id) => !isScopeAvailable(format, id, size)}
              unavailableHint={seatsHint}
              delayMs={340}
            >
              <ScopeDetail
                scope={scope}
                league={league}
                onLeagueChange={setLeague}
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
                isUnavailable={(id) => !isConstraintAvailable(format, key, id, size)}
                unavailableHint={seatsHint}
                note="One per draft — constraints don't stack."
                delayMs={420}
              />
            </div>
          </Collapse>

          {/* The bid timer is the Auction's own closing mechanism and has no
              counterpart anywhere else, so it collapses away with the rest of
              the formats rather than sitting there naming a rule they don't
              have. Same collapsing wrapper the Constraint group uses. */}
          <Collapse open={takesTimer}>
            <div className={GROUP_GAP}>
              <ChipGroup
                label="Bid timer"
                options={timers}
                value={timer}
                onChange={setTimer}
                note="How long a lot can sit without a bid. Any bid sends it back to full."
                delayMs={500}
              />
            </div>
          </Collapse>
        </>
      }
      statusMessage={resting}
      statusKey={resting}
      backControl={<BackHome />}
      actionControl={
        <Button
          variant="accent"
          disabled={!viable}
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
          Kick off →
        </Button>
      }
    />
  )
}
