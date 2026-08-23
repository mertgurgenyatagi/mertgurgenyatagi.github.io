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
import { MAX_SEATS, constraints, scopes, wheels } from '../data/lobbyOptions'
import { useI18n } from '../lib/i18n'
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
 * the constraint, the wheel's category and the seat list all travel over as router
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
  const { t } = useI18n();

  const navigate = useNavigate()
  const [format, setFormat] = useState<string | null>(() =>
    formats.some((entry) => entry.id === formatId) ? (formatId as string) : null,
  )
  const [scope, setScope] = useState('top-5')
  const [league, setLeague] = useState('premier-league')
  const [constraint, setConstraint] = useState('club-1')
  const [wheel, setWheel] = useState('league')

  /** Ids rather than a count, so adding a seat animates only the row that arrived. */
  const nextBotId = useRef(4)
  const [bots, setBots] = useState<number[]>([1, 2, 3])

  /* Chat is live here too. There is nobody else in a solo lobby to talk to yet,
     which is exactly why the table's own events go through it — a room that
     says what has happened in it is a room, and an empty panel is furniture. */
  const messageId = useRef(1)
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, kind: 'system', author: '', body: t('Table opened — three bots seated.') },
  ])
  const say = (message: Omit<Message, 'id'>) =>
    setMessages((current) => [...current, { ...message, id: messageId.current++ }])

  const seats: Seat[] = [
    {
      id: 'you',
      kind: 'you',
      name: t('You'),
      mark: 'Y',
      note: 'Host — sets the draft on the right',
      tag: 'Seat 1',
    },
    ...bots.map((id, index) => ({
      id: String(id),
      kind: 'bot' as const,
      name: t('Bot {n}', { n: index + 1 }),
      mark: String(index + 1),
      note: 'Default style',
    })),
  ]

  /** Constraints exist for Free Pick and are not offered anywhere else. */
  const takesConstraint = format === 'free-pick'
  /**
   * The wheel's category is a Spin the Wheel setting, and only an open
   * question while Scope has left both axes open — a single-league Scope has
   * already fixed league, so the wheel there can only be clubs.
   */
  const takesWheel = format === 'spin-the-wheel' && scope !== 'league'

  /**
   * How many drafters the settings have to seat. Every option below is
   * measured against this, so adding or removing a bot re-reads the panel.
   */
  const size = effectiveSize(seats.length)
  const key = scopeKeyOf(scope, league)
  const seatsHint = seatsPhrase(size, t)

  const viable = isConfigViable(format, scope, league, constraint, size)
  const reason = unavailableReason(format, scope, league, constraint, size, t)
  const dimmed = hasDimmedOptions(format, scope, league, size)

  const resting = !format
    ? t('Pick a format to start.')
    : reason
      ? reason
      : dimmed
        ? t('Dimmed options don’t support {phrase}.', { phrase: seatsHint })
        : ''

  return (
    <LobbyLayout
      leftHeadingId="table-heading"
      seatCountLabel={t('{n} / {max} seats', { n: seats.length, max: MAX_SEATS })}
      seatCountKey={seats.length}
      leftHeaderContent={
        <h1
          id="table-heading"
          className="fx fx-soft mt-[clamp(0.4rem,1.6vh,1rem)] hidden font-display text-[clamp(1.6rem,3.4vw,2.75rem)] font-bold uppercase leading-[0.95] tracking-[0.02em] md:block"
          style={{ animationDelay: '140ms' }}
        >{t("Your table")}</h1>
      }
      seatList={
        <SeatList
          seats={seats}
          onAdd={() => {
            const id = nextBotId.current
            nextBotId.current += 1
            setBots((current) => [...current, id])
            say({ kind: 'system', author: '', body: t('Bot {n} seated.', { n: bots.length + 1 }) })
          }}
          onRemove={(id) => {
            setBots((current) => current.filter((entry) => String(entry) !== id))
            say({ kind: 'system', author: '', body: t('A bot left the table.') })
          }}
        />
      }
      leftFooterContent={
        <LobbyChat
          you={t('You')}
          messages={messages}
          onSend={(body) => say({ kind: 'said', author: t('You'), body })}
        />
      }
      settingsContent={
        <>
          <ChipGroup
            label={t('Format')}
            options={formats}
            value={format}
            onChange={setFormat}
            isUnavailable={(id) => !isFormatAvailable(id, size)}
            unavailableHint={seatsHint}
            delayMs={260}
          />

          <div className={GROUP_GAP}>
            <ChipGroup
              label={t('Scope')}
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
                label={t('Constraint')}
                options={constraints}
                value={constraint}
                onChange={setConstraint}
                isUnavailable={(id) => !isConstraintAvailable(format, key, id, size)}
                unavailableHint={seatsHint}
                note={t('One per draft — constraints don’t stack, and they are shared by the table.')}
                delayMs={420}
              />
            </div>
          </Collapse>

          {/* Spin the Wheel only, and only while Scope has left both axes
              open. Same collapsing wrapper the Constraint group uses. */}
          <Collapse open={takesWheel}>
            <div className={GROUP_GAP}>
              <ChipGroup
                label={t('The wheel')}
                options={wheels}
                value={wheel}
                onChange={setWheel}
                note={t('What the wheel is cut into. Every spin uses the same one.')}
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
                wheel,
                drafters: seats.map(({ id, kind, name, mark }) => ({ id, kind, name, mark })),
              },
            })
          }}
        >{t("Kick off →")}</Button>
      }
    />
  )
}
