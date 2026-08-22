import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { DraftChat } from '../components/draft/DraftChat'
import { DraftClock } from '../components/draft/DraftClock'
import { Narrator, type NarratorTone } from '../components/draft/Narrator'
import { PitchView } from '../components/draft/PitchView'
import { PlayerPool, type PoolRow } from '../components/draft/PlayerPool'
import { PlayerSpotlight } from '../components/draft/PlayerSpotlight'
import { SpentCrests } from '../components/draft/SpentCrests'
import { TableStrip } from '../components/draft/TableStrip'
import type { Message } from '../components/lobby/LobbyChat'
import { BackHome } from '../components/ui/BackHome'
import { LanguageSwitch } from '../components/ui/LanguageSwitch'
import { SQUAD_SIZE, type FormationSlot, type PositionCode, formation } from '../data/formation'
import {
  type Drafter,
  type Pick,
  type Squad,
  botChoice,
  blockedReason,
  roundAt,
  seatAt,
  slotFor,
} from '../lib/draftEngine'
import { type Player, inScope, loadPool } from '../lib/players'
import { useMultiplayerRoom, useHostBotTakeover, makePick as remoteMakePick, sendChatMessage as remoteSendChatMessage } from '../lib/multiplayer'
import { AuctionDraft } from './AuctionDraft'
import { DondDraft } from './DondDraft'
import { SpinDraft } from './SpinDraft'
import { SquadCompare } from './SquadCompare'
import { useI18n } from '../lib/i18n'

export interface DraftConfig {
  format?: string
  scope?: string
  league?: string
  constraint?: string
  timer?: string
  drafters?: Drafter[]
  roomId?: string
}

/**
 * The table the exhibition was drawn against, and what you get by opening the
 * route cold. You sit second, which matters: a snake draft reads completely
 * differently from the end of the order than from the front of it.
 */
const DEFAULT_DRAFTERS: Drafter[] = [
  { id: 'priya', name: 'Priya', kind: 'human', mark: 'P' },
  { id: 'you', name: 'You', kind: 'you', mark: 'M' },
  { id: 'bot-1', name: 'Bot 1', kind: 'bot', mark: '1' },
  { id: 'bot-2', name: 'Bot 2', kind: 'bot', mark: '2' },
]

const WORDS = [
  'No',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
]

/** Bots pace at a human's reading speed, not at a machine's. */
const BOT_PAUSE = [1500, 3500]
/** A simulated person takes slightly longer, because a person does. */
const HUMAN_PAUSE = [2400, 5200]
/** How long the room reads "X took Y" before the narrator moves on. */
const REPORT_HOLD = 1500

const CHATTER = [
  'needed that one',
  'was hoping he would drop',
  'good pick',
  'there goes my keeper',
  'right, plan b',
  'cannot argue with that',
]

export function Draft() {

  const { formatId } = useParams()
  const location = useLocation()
  const config = (location.state ?? {}) as DraftConfig

  // Keyed on the format so arriving at a different one rebuilds the draft
  // rather than resuming somebody else's.
  //
  // All four screens live behind this route. They share the pool, the pitch,
  // the table strip and the chat; what differs is where a turn's board comes
  // from — a free pick reads the whole scope, a spin reads whatever the wheel
  // stopped on, Deal or No Deal has no board at all, only boxes, and the
  // Auction has no *turn* at all, only a lot and a clock measuring how long
  // nobody has raised on it. That difference is structural enough for each to
  // be its own layout.
  if (formatId === 'spin-the-wheel') return <SpinDraft key={formatId} config={config} />
  if (formatId === 'deal-or-no-deal') return <DondDraft key={formatId} config={config} />
  if (formatId === 'auction') return <AuctionDraft key={formatId} config={config} />

  return <DraftRoom key={formatId ?? 'free-pick'} config={config} />
}

export function DraftRoom({ config }: { config: DraftConfig }) {
  const { t } = useI18n();

  const scope = config.scope ?? 'top-5'
  const league = config.league ?? 'premier-league'
  const constraint = config.constraint ?? 'club-1'
  /* **No clock on this screen.** The timer is the Auction's, and only the
     Auction's: what it measures there is how long a lot has sat without a bid,
     which is that format's own closing mechanism. A snake draft closes itself —
     the turn passes when somebody picks — so there was nothing here for a
     countdown to end. The state, the tick, the mobile seconds badge and the
     cheapest-eligible auto-pick that fired on zero are all gone with it. */

  const { room, uid } = useMultiplayerRoom(config.roomId)
  const isMultiplayer = Boolean(config.roomId)
  const isHost = isMultiplayer ? room?.host === uid : true
  useHostBotTakeover(config.roomId, isHost, room)

  const baseDrafters = config.drafters?.length ? config.drafters : DEFAULT_DRAFTERS
  
  const drafters = useMemo(() => {
    if (!isMultiplayer || !room?.drafters) return baseDrafters
    return baseDrafters.map(d => {
      const rd = room.drafters[d.id]
      if (rd) {
        // If it's your seat, keep it 'you' locally so the UI knows it's you, otherwise take remote kind
        const kind = d.kind === 'you' ? 'you' : rd.kind
        return { ...d, kind } as Drafter
      }
      return d
    })
  }, [baseDrafters, isMultiplayer, room?.drafters])

  const seatCount = drafters.length
  const youSeat = Math.max(0, drafters.findIndex((drafter) => drafter.kind === 'you'))
  const totalPicks = seatCount * SQUAD_SIZE

  const [pool, setPool] = useState<Player[]>([])
  const [poolError, setPoolError] = useState<string | null>(null)

  const [localPicks, setLocalPicks] = useState<Pick[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<PositionCode | null>(null)
  const [tab, setTab] = useState(youSeat)
  const [pane, setPane] = useState<'pool' | 'board'>('pool')
  const [narration, setNarration] = useState<{ text: string; tone: NarratorTone; beat: number }>({
    text: 'Waiting for the board.',
    tone: 'settled',
    beat: 0,
  })
  const [localMessages, setLocalMessages] = useState<Message[]>([])

  const messageId = useRef(1)

  // Derive picks from room if multiplayer, else local
  const picks = useMemo(() => {
    if (isMultiplayer) {
      if (!room?.picks || pool.length === 0) return []
      const remote = Object.values(room.picks).sort((a, b) => a.overall - b.overall)
      return remote.map(p => {
        const player = pool.find(pl => pl.id === p.playerId)
        if (!player) return null // should not happen if pool is loaded
        return {
          overall: p.overall,
          seat: p.seat,
          slot: p.slot,
          player
        }
      }).filter((p): p is Pick => p !== null)
    }
    return localPicks
  }, [isMultiplayer, room?.picks, pool, localPicks])

  const messages = useMemo(() => {
    if (isMultiplayer) {
      if (!room?.chat) return []
      return Object.values(room.chat).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
    }
    return localMessages
  }, [isMultiplayer, room?.chat, localMessages])

  useEffect(() => {
    const controller = new AbortController()
    loadPool(controller.signal)
      .then(setPool)
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setPoolError(error instanceof Error ? error.message : 'The player pool would not load.')
      })
    return () => controller.abort()
  }, [])

  const scoped = useMemo(
    () => pool.filter((player) => inScope(player, scope, league)),
    [pool, scope, league],
  )

  const overall = picks.length
  const complete = overall >= totalPicks
  const activeSeat = complete ? -1 : seatAt(overall, seatCount)
  const yourTurn = activeSeat === youSeat
  const round = complete ? SQUAD_SIZE : roundAt(overall, seatCount)

  const squads = useMemo(() => {
    const built: Squad[] = drafters.map(() => ({}))
    for (const pick of picks) built[pick.seat][pick.slot] = pick.player
    return built
  }, [picks, drafters])

  const taken = useMemo(() => new Set(picks.map((pick) => pick.player.id)), [picks])
  const yourSquad = squads[youSeat] ?? {}

  /* When the last pick lands, hand off to the comparison screen. Keep the
     draft state alive in this component so the back button can return here
     later without re-running the whole draft — it is just a conditional render,
     not a navigation. */
  if (complete) {
    return <SquadCompare drafters={drafters} squads={squads} />
  }

  /* ------------------------------------------------------------- picking -- */

  /**
   * One entry point for every pick, whoever makes it. The choice is computed
   * inside the state updater so it reads the squad it is actually landing in —
   * a timer that fires twice, or a click that races a timeout, cannot produce
   * two picks from one turn.
   */
  const commit = useCallback(
    (seat: number, choose: (squad: Squad, taken: ReadonlySet<string>) => Player | null) => {
      if (isMultiplayer && config.roomId) {
        if (picks.length >= totalPicks) return
        if (seatAt(picks.length, seatCount) !== seat) return

        const squad: Squad = {}
        const already = new Set<string>()
        for (const pick of picks) {
          already.add(pick.player.id)
          if (pick.seat === seat) squad[pick.slot] = pick.player
        }

        const player = choose(squad, already)
        if (!player) return
        const slot = slotFor(player, squad)
        if (!slot) return

        remoteMakePick(config.roomId, { overall: picks.length, seat, slot, player })
      } else {
        setLocalPicks((previous) => {
          if (previous.length >= totalPicks) return previous
          if (seatAt(previous.length, seatCount) !== seat) return previous

          const squad: Squad = {}
          const already = new Set<string>()
          for (const pick of previous) {
            already.add(pick.player.id)
            if (pick.seat === seat) squad[pick.slot] = pick.player
          }

          const player = choose(squad, already)
          if (!player) return previous
          const slot = slotFor(player, squad)
          if (!slot) return previous

          return [...previous, { overall: previous.length, seat, slot, player }]
        })
      }
    },
    [seatCount, totalPicks, isMultiplayer, config.roomId, picks],
  )

  const draftSelected = useCallback(() => {
    if (!yourTurn || !selectedId) return
    commit(youSeat, (squad, already) => {
      const player = scoped.find((entry) => entry.id === selectedId)
      if (!player) return null
      return blockedReason(player, squad, constraint, already) === null ? player : null
    })
  }, [yourTurn, selectedId, commit, youSeat, scoped, constraint])

  /* ------- The turn loop. Everyone but you is simulated, on a stagger. ----- */

  useEffect(() => {
    if (complete || scoped.length === 0 || activeSeat === youSeat) return
    if (isMultiplayer && !isHost) return // Only host simulates bots in multiplayer

    const drafter = drafters[activeSeat]
    if (drafter.kind !== 'bot') {
      // If multiplayer and this is a human seat, don't simulate them! They will make their own picks.
      if (isMultiplayer) return
    }

    const [low, high] = drafter.kind === 'bot' ? BOT_PAUSE : HUMAN_PAUSE
    const wait = low + Math.random() * (high - low)

    const timer = window.setTimeout(() => {
      commit(activeSeat, (squad, already) =>
        botChoice(scoped, squad, constraint, already, SQUAD_SIZE - round + 1),
      )
    }, wait)

    return () => window.clearTimeout(timer)
  }, [activeSeat, complete, scoped, youSeat, drafters, commit, constraint, round, isMultiplayer, isHost])

  /* ---------------------------------------------------------- the narrator -- */

  useEffect(() => {
    if (scoped.length === 0) return

    const turnLine = (): { text: string; tone: NarratorTone } => {
      if (complete) return { text: 'Every eleven is full. The draft is done.', tone: 'settled' }
      if (activeSeat === youSeat) return { text: 'Your pick.', tone: 'you' }
      return { text: `${drafters[activeSeat].name} is picking.`, tone: 'waiting' }
    }

    const last = picks[picks.length - 1]
    if (!last) {
      const line = turnLine()
      setNarration({ ...line, beat: 0 })
      return
    }

    setNarration({
      text: `${drafters[last.seat].name} took ${last.player.name} — ${last.player.position}, ${last.player.club}.`,
      tone: 'settled',
      beat: last.overall * 2 + 1,
    })

    const timer = window.setTimeout(() => {
      const line = turnLine()
      setNarration({ ...line, beat: last.overall * 2 + 2 })
    }, REPORT_HOLD)

    return () => window.clearTimeout(timer)
  }, [picks, complete, activeSeat, youSeat, drafters, scoped.length])

  // A round turning over is the one structural event the pick line cannot
  // carry, because it happens between two picks rather than at one.
  const previousRound = useRef(1)
  useEffect(() => {
    if (round === previousRound.current || complete) return
    previousRound.current = round
    if (isMultiplayer && isHost && config.roomId) {
      // Only host writes the system message
      remoteSendChatMessage(config.roomId, '', `Round ${round} — the order reverses`)
    } else if (!isMultiplayer) {
      setLocalMessages((current) => [
        ...current,
        {
          id: messageId.current++,
          kind: 'system',
          author: '',
          body: `Round ${round} — the order reverses`,
        },
      ])
    }
  }, [round, complete, isMultiplayer, isHost, config.roomId])

  // The room talks about what just went. Not every pick, or it is noise.
  const chattered = useRef(-1)
  useEffect(() => {
    const last = picks[picks.length - 1]
    if (!last || last.seat === youSeat || last.overall === chattered.current) return
    chattered.current = last.overall
    if (Math.random() > 0.34) return

    const timer = window.setTimeout(() => {
      if (isMultiplayer && isHost && config.roomId) {
        // We only want the host to simulate bots talking in multiplayer
        if (drafters[last.seat].kind === 'bot') {
           remoteSendChatMessage(config.roomId, drafters[last.seat].name, CHATTER[Math.floor(Math.random() * CHATTER.length)])
        }
      } else if (!isMultiplayer) {
        setLocalMessages((current) => [
          ...current,
          {
            id: messageId.current++,
            kind: 'said',
            author: drafters[last.seat].name,
            body: CHATTER[Math.floor(Math.random() * CHATTER.length)],
          },
        ])
      }
    }, 900)

    return () => window.clearTimeout(timer)
  }, [picks, youSeat, drafters, isMultiplayer, isHost, config.roomId])

  /* ------------------------------------------------------------- the pool -- */

  const rows: PoolRow[] = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const result: PoolRow[] = []

    for (const player of scoped) {
      if (taken.has(player.id)) continue
      if (filter && player.position !== filter) continue
      if (
        needle &&
        !player.name.toLowerCase().includes(needle) &&
        !player.club.toLowerCase().includes(needle) &&
        !player.nation.toLowerCase().includes(needle)
      ) {
        continue
      }
      result.push({ player, blocked: blockedReason(player, yourSquad, constraint, taken) })
    }

    return result
  }, [scoped, taken, filter, query, yourSquad, constraint])

  const byId = useMemo(() => new Map(scoped.map((player) => [player.id, player])), [scoped])

  // The selection has to survive somebody else taking your man.
  useEffect(() => {
    if (selectedId && !taken.has(selectedId) && byId.has(selectedId)) return
    const first = rows.find((row) => !row.blocked) ?? rows[0]
    setSelectedId(first?.player.id ?? null)
  }, [selectedId, taken, byId, rows])

  /**
   * Your turn opening on a selection you cannot actually take is a dead button
   * and no stated reason to look elsewhere — and it happens constantly, because
   * the thing that blocked them is usually your own last pick. So the clock
   * landing on you moves the selection to the first footballer who is yours to
   * take.
   *
   * Once per turn, not continuously: selecting a blocked player on purpose is
   * how you read why they are blocked, and an effect that bounced you off them
   * every render would make that impossible.
   */
  const armedFor = useRef(-1)
  useEffect(() => {
    if (!yourTurn || rows.length === 0) return
    if (armedFor.current === overall) return
    armedFor.current = overall

    const current = rows.find((row) => row.player.id === selectedId)
    if (current && !current.blocked) return
    const first = rows.find((row) => !row.blocked)
    if (first) setSelectedId(first.player.id)
  }, [yourTurn, overall, rows, selectedId])

  useEffect(() => {
    if (yourTurn) setTab(youSeat)
  }, [yourTurn, youSeat])

  const selected = selectedId ? (byId.get(selectedId) ?? null) : null

  const selectedBlocked = selected ? blockedReason(selected, yourSquad, constraint, taken) : null
  const canDraft = Boolean(yourTurn && selected && !selectedBlocked)

  const openSlots = formation.filter((slot) => !yourSquad[slot.id]).length
  const filledPositions = useMemo(() => {
    const full = new Set<PositionCode>()
    for (const slot of formation) {
      if (!yourSquad[slot.id]) continue
      const others = formation.filter((entry) => entry.position === slot.position)
      if (others.every((entry) => yourSquad[entry.id])) full.add(slot.position)
    }
    return full
  }, [yourSquad])

  const pendingSlot: FormationSlot | null =
    yourTurn && selected && !selectedBlocked
      ? (formation.find((slot) => slot.id === slotFor(selected, yourSquad)) ?? null)
      : null

  const reason = (() => {
    if (poolError) return poolError
    if (scoped.length === 0) return 'Reading the board…'
    if (complete) return 'Every eleven is full.'
    if (!yourTurn) return `Waiting on ${drafters[activeSeat].name}.`
    if (!selected) return `${WORDS[openSlots] ?? openSlots} positions open to you.`
    if (selectedBlocked) return selectedBlocked
    return `${selected.surname} fills your ${selected.position}.`
  })()

  const actionLabel = canDraft && selected ? `Draft ${selected.surname} →` : 'Draft →'

  /* -------------------------------------------------------------- spent --- */

  const yourPlayers = formation
    .map((slot) => yourSquad[slot.id])
    .filter((player): player is Player => Boolean(player))

  const spentClubs = [...new Set(yourPlayers.map((player) => player.clubSlug))]
  const clubNames = Object.fromEntries(yourPlayers.map((player) => [player.clubSlug, player.club]))
  const spentNations = [...new Set(yourPlayers.map((player) => player.nation))]

  const you = drafters[youSeat]
  const lastArrival = picks[picks.length - 1]?.player.id ?? null

  return (
    <div className="draft flex h-full w-full flex-col px-[var(--app-inset-x)] py-[var(--app-inset-y)]">
      {/* ---- The way out, the narrator, and the table it is talking about.
              The narrator takes the middle of the bar on every draft screen:
              it is the one line that says where the draft is, so it is set at
              the centre and at size rather than tucked in beside a link. ---- */}
      <div className="fx fx-soft flex shrink-0 flex-col items-stretch gap-[10px] border-b border-line py-[12px] sm:flex-row sm:items-center sm:gap-5">
        <div className="flex shrink-0 items-center gap-3">
          <BackHome confirm />
          <LanguageSwitch className="hidden sm:flex" />
        </div>

        <div className="flex min-w-0 flex-1 justify-center">
          <Narrator text={narration.text} tone={narration.tone} beat={narration.beat} />
        </div>

        <div className="flex shrink-0 items-center justify-end">
          <TableStrip drafters={drafters} active={activeSeat} />
        </div>
      </div>

      {/* ---- Three columns, divided by hairlines rather than surface steps. ---- */}
      <div className="draft-grid min-h-0 flex-1">
        <div
          className="draft-rail fx fx-soft flex-col gap-[26px] pr-[30px] pt-[22px]"
          style={{ animationDelay: '90ms' }}
        >
          <DraftClock round={round} rounds={SQUAD_SIZE} />

          <SpentCrests
            constraint={constraint}
            clubs={spentClubs}
            clubNames={clubNames}
            nations={spentNations}
          />

          <DraftChat
            messages={messages}
            you={you.name}
            onSend={(body) => {
              if (isMultiplayer && config.roomId) {
                remoteSendChatMessage(config.roomId, you.name, body)
              } else {
                setLocalMessages((current) => [
                  ...current,
                  { id: messageId.current++, kind: 'said', author: you.name, body },
                ])
              }
            }}
          />
        </div>

        <div
          className={[
            'fx fx-soft min-h-0 flex-col pt-[22px] min-[1180px]:flex min-[1180px]:border-l min-[1180px]:border-line min-[1180px]:px-[30px] md:flex md:pr-[30px]',
            pane === 'pool' ? 'flex' : 'hidden',
          ].join(' ')}
          style={{ animationDelay: '150ms' }}
        >
          <PlayerPool
            rows={rows}
            query={query}
            onQuery={setQuery}
            filter={filter}
            onFilter={setFilter}
            filled={filledPositions}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onDraft={draftSelected}
            canDraft={canDraft}
            reason={reason}
            actionLabel={actionLabel}
            portrait={
              <PlayerSpotlight
                player={selected}
                onDraft={draftSelected}
                canDraft={canDraft}
                reason={reason}
                actionLabel={actionLabel}
                frame="spotlight-free-pick"
              />
            }
          />
        </div>

        <div
          className={[
            'fx fx-soft min-h-0 flex-col pt-[22px] md:flex md:border-l md:border-line md:pl-[30px]',
            pane === 'board' ? 'flex' : 'hidden',
          ].join(' ')}
          style={{ animationDelay: '210ms' }}
        >
          <PitchView
            drafters={drafters}
            tab={tab}
            onTab={setTab}
            squad={squads[tab] ?? {}}
            pending={tab === youSeat ? pendingSlot : null}
            preview={tab === youSeat ? selected : null}
            lastArrival={lastArrival}
          />
        </div>
      </div>

      {/* ---- One viewport, one column: the two halves take turns. ---- */}
      <div className="mt-[12px] flex shrink-0 items-center gap-[2px] border-t border-line pt-[10px] md:hidden">
        <PaneTab active={pane === 'pool'} onClick={() => setPane('pool')}>{t("Who is left")}</PaneTab>
        <PaneTab active={pane === 'board'} onClick={() => setPane('board')}>{t("The elevens")}</PaneTab>
      </div>
    </div>
  )
}

function PaneTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'flex-1 border-b px-2 py-[7px] font-display text-[10px] font-medium uppercase tracking-[0.14em] transition-colors duration-150 ease-out',
        active ? 'border-accent text-ink' : 'border-transparent text-dim hover:text-muted',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
