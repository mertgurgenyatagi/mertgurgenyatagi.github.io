import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DraftChat } from '../components/draft/DraftChat'
import { Narrator, type NarratorTone } from '../components/draft/Narrator'
import { type FeedLine, NarratorFeed } from '../components/draft/NarratorFeed'
import { PitchView } from '../components/draft/PitchView'
import { PlayerSpotlight } from '../components/draft/PlayerSpotlight'
import { SpinWheel } from '../components/draft/SpinWheel'
import { TurnIndicator } from '../components/draft/TurnIndicator'
import { WheelPool } from '../components/draft/WheelPool'
import type { Message } from '../components/lobby/LobbyChat'
import { BackHome } from '../components/ui/BackHome'
import { LanguageSwitch } from '../components/ui/LanguageSwitch'
import {
  SQUAD_SIZE,
  type FormationSlot,
  type PositionCode,
  formation,
  positionCodes,
} from '../data/formation'
import {
  type Drafter,
  type Pick,
  type Squad,
  botChoice,
  isEligible,
  roundAt,
  seatAt,
  slotFor,
} from '../lib/draftEngine'
import {
  useMultiplayerRoom,
  useHostBotTakeover,
  useActionQueue,
  updateSpinState,
  placeSpinAction,
  sendChatMessage,
  sendSystemMessage,
} from '../lib/multiplayer'
import { useSeats } from '../lib/seats'
import { DraftGate } from '../components/draft/DraftGate'
import { type Player, inScope, loadPool } from '../lib/players'
import {
  type WheelSlice,
  categoryFor,
  entityKey,
  landingRotation,
  wheelSlices,
} from '../lib/wheelEngine'
import type { DraftConfig } from './Draft'
import { SquadCompare } from './SquadCompare'
import { useI18n } from '../lib/i18n'

/**
 * The table you get by opening the route cold, matching the Free Pick screen's
 * so the two read as one game rather than two demos.
 */
const DEFAULT_DRAFTERS: Drafter[] = [
  { id: 'priya', name: 'Priya', kind: 'human', mark: 'P' },
  { id: 'you', name: 'You', kind: 'you', mark: 'M' },
  { id: 'bot-1', name: 'Bot 1', kind: 'bot', mark: '1' },
  { id: 'bot-2', name: 'Bot 2', kind: 'bot', mark: '2' },
]

/**
 * The spin runs long on purpose. At 2.8s the wheel read as a control settling
 * rather than as a wheel somebody had put their hand through; the whole point
 * of drawing this format as a wheel is the wait, and eight turns need the room
 * to decelerate through. Forty-four of them over a draft is the cost, and it
 * is the right one — there is nothing else happening while it turns.
 */
const SPIN_MS = 5600
const BOT_PAUSE = [1500, 3400]
const HUMAN_PAUSE = [2400, 5000]


/**
 * Spin the Wheel, drawn as layout 08 of the exhibition — the wheel is the sun
 * and everything else orbits it at a respectful distance.
 *
 * The pick underneath is a free pick: same snake order, same slot gate, same
 * A–Z pool, and no constraints at all in this format. What changes is where
 * the pool comes from. Every turn, for every drafter, the wheel is rebuilt
 * out of the entities that still hold somebody that drafter could legally
 * take, spun, and whatever it stops on is the whole board for that turn.
 */
export function SpinDraft({ config }: { config: DraftConfig }) {
  const { t } = useI18n();

  const scope = config.scope ?? 'top-5'
  const league = config.league ?? 'premier-league'

  /* No clock: the bid timer is the Auction's alone — see the note where `timers`
     used to be in lobbyOptions. A spin ends the turn when somebody picks off what it
     landed on, so there was never anything here for a countdown to close. */

  const { room, uid } = useMultiplayerRoom(config.roomId)
  const isMultiplayer = Boolean(config.roomId)
  const isHost = isMultiplayer ? room?.host === uid : true
  useHostBotTakeover(config.roomId, isHost, room)

  const baseDrafters = config.drafters?.length ? config.drafters : DEFAULT_DRAFTERS
  const { drafters, youSeat, seated } = useSeats(baseDrafters, isMultiplayer, room, uid)

  const seatCount = drafters.length
  const totalPicks = seatCount * SQUAD_SIZE

  /* The wheel's category is fixed once, here, and never changes between spins
     *(R5-Q1)*. Which of the two open axes it gets fixed to is the lobby's
     choice as of 2026-08-23 — see `wheels` in lobbyOptions. */
  const category = useMemo(() => categoryFor(scope, config.wheel), [scope, config.wheel])

  const [pool, setPool] = useState<Player[]>([])
  const [poolError, setPoolError] = useState<string | null>(null)

  const [picks, setPicks] = useState<Pick[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<PositionCode | null>(null)
  const [tab, setTab] = useState(0)
  const [pane, setPane] = useState<'wheel' | 'pool' | 'board'>('pool')
  const [localMessages, setMessages] = useState<Message[]>([])
  const messages = useMemo(() => {
    if (isMultiplayer) {
      if (!room?.chat) return []
      return Object.values(room.chat).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
    }
    return localMessages
  }, [isMultiplayer, room?.chat, localMessages])
  const [feed, setFeed] = useState<FeedLine[]>([])

  const [rotation, setRotation] = useState(-179)
  const [phase, setPhase] = useState<'spinning' | 'landed'>('spinning')

  const [landed, setLanded] = useState<WheelSlice | null>(null)
  const [landedTurn, setLandedTurn] = useState(-1)
  
  // Sync state from host to clients
  useEffect(() => {
    if (isMultiplayer && !isHost && room?.spinState) {
      setPicks(room.spinState.picks || [])
      setFeed(room.spinState.feed || [])
      setRotation(room.spinState.rotation || 0)
      setPhase(room.spinState.phase || 'spinning')
      setLanded(room.spinState.landed || null)
      setLandedTurn(room.spinState.landedTurn ?? -1)
    }
  }, [isMultiplayer, isHost, room?.spinState])

  // Sync state from host to firebase
  useEffect(() => {
    if (isMultiplayer && isHost && config.roomId) {
      updateSpinState(config.roomId, { picks, feed, rotation, phase, landed, landedTurn })
    }
  }, [isMultiplayer, isHost, config.roomId, picks, feed, rotation, phase, landed, landedTurn])

  /**
   * Which turn the wheel currently on screen was spun for. A pick lands one
   * commit before the effect that starts the next spin runs, so for exactly
   * one render `phase` still says `landed` while `overall` has already moved
   * on — long enough for the report to announce the next turn's landing
   * before the pick that caused it, and for the pool to be rebuilt out of the
   * old category against the new drafter. Stamping the landing with its own
   * turn is what makes that window unrepresentable rather than merely rare.
   */

  const messageId = useRef(1)
  const lineId = useRef(1)

  const report = useCallback((text: string, tone: NarratorTone) => {
    setFeed((current) => [{ id: lineId.current++, text, tone }, ...current].slice(0, 4))
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    loadPool(controller.signal)
      .then(setPool)
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setPoolError(error instanceof Error ? error.message : t('The player pool would not load.'))
      })
    return () => controller.abort()
  }, [])

  const scoped = useMemo(
    () => pool.filter((player) => inScope(player, scope, league)),
    [pool, scope, league],
  )
  const ready = scoped.length > 0

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
  const activeSquad = squads[activeSeat >= 0 ? activeSeat : youSeat] ?? {}

  /* --------------------------------------------------------------- picking -- */

  /**
   * One entry point for every pick, whoever makes it, with the choice computed
   * inside the state updater so it reads the squad it is actually landing in.
   * A timer that fires twice, or a click racing a timeout, cannot produce two
   * picks from one turn.
   */
  const commit = useCallback(
    (seat: number, choose: (squad: Squad, taken: ReadonlySet<string>) => Player | null) => {
      setPicks((previous) => {
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
    },
    [seatCount, totalPicks],
  )

  /* ------------------------------------------------------------- the wheel -- */

  const slices = useMemo(
    () => (ready && !complete ? wheelSlices(scoped, activeSquad, taken, category) : []),
    [ready, complete, scoped, activeSquad, taken, category],
  )
  const slicesRef = useRef(slices)
  slicesRef.current = slices

  /* The last face the wheel actually had, so a finished draft leaves it
     standing where it stopped rather than blanking it to a grey disc. */
  const lastFace = useRef<WheelSlice[]>([])
  if (slices.length > 0) lastFace.current = slices
  const face = slices.length > 0 ? slices : lastFace.current
  useEffect(() => {
    if (!ready || complete) return
    if (isMultiplayer && !isHost) return

    const current = slicesRef.current
    const index = current.length > 0 ? Math.floor(Math.random() * current.length) : -1

    setPhase('spinning')
    setLanded(null)
    setRotation((previous) => landingRotation(previous, index, current.length))

    const turn = overall
    const timer = window.setTimeout(() => {
      const slice = index >= 0 ? current[index] : null
      setLanded(slice)
      setLandedTurn(turn)
      setPhase('landed')
    }, SPIN_MS)

    return () => window.clearTimeout(timer)
  }, [ready, complete, overall, isMultiplayer, isHost])

  /** True only while the wheel on screen is the one this turn was spun for. */
  const settled = phase === 'landed' && landedTurn === overall

  /** The landing, reported once, with whose turn it opens folded into the line. */
  const announced = useRef(-1)
  useEffect(() => {
    if (!settled || complete || announced.current === overall) return
    announced.current = overall

    const where = landed
      ? t('The wheel landed on {slice}', { slice: t(landed.label) })
      : t('The wheel came up empty — the whole board is open')
    if (yourTurn) report(t('{where} — your pick.', { where }), 'you')
    else {
      report(
        t('{where} — {name} is picking.', { where, name: drafters[activeSeat]?.name ?? '' }),
        'waiting',
      )
    }
  }, [settled, overall, complete, landed, yourTurn, drafters, activeSeat, report])

  /**
   * Whoever is on the clock, everyone the wheel just handed them. Twice
   * narrowed — by the slice, and by the shape of their own eleven — so there
   * is nothing left in it that cannot be taken.
   */
  const entityPool = useMemo(() => {
    if (!ready || complete || !settled || activeSeat < 0) return []
    const inCategory = landed
      ? scoped.filter((player) => entityKey(player, category) === landed.key)
      : scoped
    return inCategory.filter((player) => isEligible(player, activeSquad, 'none', taken))
  }, [ready, complete, settled, activeSeat, landed, scoped, category, activeSquad, taken])

  const entityPoolRef = useRef(entityPool)
  entityPoolRef.current = entityPool

  /* --------- The turn loop. Everyone but you is simulated, on a stagger. ---- */

  useEffect(() => {
    if (complete || !settled || activeSeat < 0 || activeSeat === youSeat) return
    if (entityPool.length === 0) return
    if (isMultiplayer && !isHost) return

    const drafter = drafters[activeSeat]
    if (isMultiplayer && drafter.kind !== 'bot') return

    const [low, high] = drafter.kind === 'bot' ? BOT_PAUSE : HUMAN_PAUSE
    const wait = low + Math.random() * (high - low)

    const timer = window.setTimeout(() => {
      commit(activeSeat, (squad, already) =>
        botChoice(entityPoolRef.current, squad, 'none', already, SQUAD_SIZE - round + 1),
      )
    }, wait)

    return () => window.clearTimeout(timer)
  }, [settled, activeSeat, complete, youSeat, drafters, commit, round, entityPool.length, isMultiplayer, isHost])

  /* ---------------------------------------------------------- the reporting -- */

  const reported = useRef(-1)
  useEffect(() => {
    const last = picks[picks.length - 1]
    if (!last || reported.current === last.overall) return
    reported.current = last.overall
    report(
      t('{name} took {player} — {position}, {club}.', {
        name: drafters[last.seat]?.name ?? '',
        player: last.player.name,
        position: t(last.player.position),
        club: last.player.club,
      }),
      'settled',
    )
  }, [picks, drafters, report])

  useEffect(() => {
    if (!complete) return
    report(t('Every eleven is full. The draft is done.'), 'settled')
  }, [complete, report])

  // A round turning over is the one structural event a pick line cannot carry,
  // because it happens between two picks rather than at one.
  const previousRound = useRef(1)
  useEffect(() => {
    if (round === previousRound.current || complete) return
    previousRound.current = round
    report(t('Round {n} — the order reverses', { n: round }), 'settled')
    if (isMultiplayer && isHost && config.roomId) {
      sendSystemMessage(config.roomId, t('Round {n} — the order reverses', { n: round }))
    } else if (!isMultiplayer) {
      setMessages((current) => [
        ...current,
        {
          id: messageId.current++,
          kind: 'system',
          author: '',
          body: t('Round {n} — the order reverses', { n: round }),
        },
      ])
    }
  }, [round, complete, report, isMultiplayer, isHost, config.roomId])



  /* --------------------------------------------------------------- the list -- */

  // A new spin is a new board, so the search and the position filter that
  // narrowed the old one do not carry over into it.
  useEffect(() => {
    setQuery('')
    setFilter(null)
  }, [overall])

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return entityPool.filter((player) => {
      if (filter && player.position !== filter) return false
      if (!needle) return true
      return (
        player.name.toLowerCase().includes(needle) ||
        player.club.toLowerCase().includes(needle) ||
        player.nation.toLowerCase().includes(needle)
      )
    })
  }, [entityPool, filter, query])

  /** Only the positions actually on this board — the rest would be dead options. */
  const positions = useMemo(() => {
    const present = new Set(entityPool.map((player) => player.position))
    return positionCodes.filter((code) => present.has(code))
  }, [entityPool])

  useEffect(() => {
    if (rows.some((player) => player.id === selectedId)) return
    setSelectedId(rows[0]?.id ?? null)
  }, [rows, selectedId])

  const tabbed = useRef(false)
  useEffect(() => {
    if (tabbed.current || youSeat < 0) return
    tabbed.current = true
    setTab(youSeat)
  }, [youSeat])

  useEffect(() => {
    if (yourTurn && youSeat >= 0) setTab(youSeat)
  }, [yourTurn, youSeat])

  const selected = useMemo(
    () => rows.find((player) => player.id === selectedId) ?? null,
    [rows, selectedId],
  )

  const canDraft = Boolean(yourTurn && settled && selected)

  const draftSelected = useCallback(() => {
    if (!selected) return
    if (isMultiplayer && !isHost && config.roomId) {
      placeSpinAction(config.roomId, youSeat, { type: 'draft', playerId: selected.id })
      return
    }
    if (!canDraft) return
    commit(youSeat, (squad, already) =>
      isEligible(selected, squad, 'none', already) ? selected : null,
    )
  }, [canDraft, selected, commit, youSeat, isMultiplayer, isHost, config.roomId])

  useActionQueue(config.roomId, 'spinActions', isMultiplayer && isHost, (payload) => {
    if (typeof payload.seat !== 'number' || payload.action?.type !== 'draft') return
    commit(payload.seat, (squad, already) => {
      const remoteSelected = entityPoolRef.current.find((p) => p.id === payload.action.playerId)
      if (!remoteSelected) return null
      return isEligible(remoteSelected, squad, 'none', already) ? remoteSelected : null
    })
  })

  const pendingSlot: FormationSlot | null =
    canDraft && selected
      ? (formation.find((slot) => slot.id === slotFor(selected, yourSquad)) ?? null)
      : null

  /* ---------------------------------------------------------------- copy ---- */

  const status: { text: string; tone: NarratorTone } = complete
    ? { text: t('The draft is done.'), tone: 'settled' }
    : !ready
      ? { text: t('Reading the board.'), tone: 'settled' }
      : !settled
        ? { text: t('The wheel is spinning.'), tone: 'waiting' }
        : yourTurn
          ? { text: t('Your pick.'), tone: 'you' }
          : {
              text: t('{name} is picking.', { name: drafters[activeSeat]?.name ?? '' }),
              tone: 'waiting',
            }

  const whose =
    activeSeat < 0 || yourTurn
      ? t('open slots')
      : t("{name}'s slots", { name: drafters[activeSeat]?.name ?? '' })
  const poolTitle = complete
    ? t('The board is closed')
    : !settled
      ? t('The wheel is turning')
      : `${landed ? t(landed.label) : t('Open board')} · ${whose}`

  const reason = (() => {
    if (poolError) return poolError
    if (!ready) return t('Reading the board…')
    if (complete) return t('Every eleven is full.')
    if (!settled) return t('The wheel is turning.')
    if (!yourTurn) return t('Waiting on {name}.', { name: drafters[activeSeat]?.name ?? '' })
    if (!selected) return t('Nothing on this board fits your eleven.')
    return t('{name} fills your {position}.', {
      name: selected.surname,
      position: t(selected.position),
    })
  })()

  const actionLabel =
    canDraft && selected ? t('Draft {name} →', { name: selected.surname }) : t('Draft →')

  const you = drafters[youSeat]
  const lastArrival = picks[picks.length - 1]?.player.id ?? null

  /* Nothing below this line is safe to draw without a seat — see `DraftGate`. */
  if (!seated || !you) return <DraftGate />

  if (complete) {
    return <SquadCompare drafters={drafters} squads={squads} />
  }

  return (
    <div
      className="spin flex h-full w-full flex-col px-[var(--app-inset-x)] py-[var(--app-inset-y)]"
      data-pane={pane}
    >
      {/* ---- The way out, the narrator in the middle, and where the draft
              stands. Same three-part bar as the other three screens. ---- */}
      <header className="flex shrink-0 flex-col items-stretch gap-x-5 gap-y-[6px] pb-[var(--spin-gap-y)] sm:flex-row sm:items-center">
        <div className="flex shrink-0 items-center gap-3">
          <BackHome confirm />
          <LanguageSwitch className="hidden sm:flex" />
        </div>

        <div className="flex min-w-0 flex-1 justify-center">
          <Narrator
            text={status.text}
            tone={status.tone}
            beat={overall * 2 + (settled ? 1 : 0)}
          />
        </div>

        <span className="shrink-0 text-right font-display text-[10px] font-medium uppercase leading-none tracking-[0.2em] text-muted">
          {t('Round {n} of {total}', { n: round, total: SQUAD_SIZE })}
        </span>
      </header>

      {/* ---- The orbit: one sun, four satellites, none of them touching. ---- */}
      <div className="spin-grid min-h-0 flex-1">
        <div className="spin-area spin-area-wheel fx fx-soft">
          <SpinWheel
            slices={face}
            category={category}
            rotation={rotation}
            spinning={!settled && !complete}
            landed={landed}
            durationMs={SPIN_MS}
            done={complete}
          />
        </div>

        {/* The wheel's own column-mate — the pool, with chat stacked under it
            at a 66/33 height split, same column turn used to occupy. */}
        <div className="spin-area spin-area-mid gap-[var(--spin-gap-y)]">
          <div className="spin-area flex-[66] fx fx-soft" style={{ animationDelay: '90ms' }}>
            <WheelPool
              title={poolTitle}
              rows={rows}
              query={query}
              onQuery={setQuery}
              filter={filter}
              onFilter={setFilter}
              positions={positions}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onDraft={draftSelected}
              canDraft={canDraft}
              reason={reason}
              actionLabel={actionLabel}
              spinning={!settled && !complete}
              portrait={
                <PlayerSpotlight
                  player={selected}
                  onDraft={draftSelected}
                  canDraft={canDraft}
                  reason={reason}
                  actionLabel={actionLabel}
                  frame="spotlight-spin"
                  className="hidden min-w-0 lg:block lg:flex-[35]"
                />
              }
            />
          </div>

          <div className="spin-area spin-area-chat flex-[33] fx fx-soft" style={{ animationDelay: '330ms' }}>
            <div className="spin-panel flex min-h-0 flex-1 flex-col p-[14px]">
              <DraftChat
                messages={messages}
                you={you.name}
                onSend={(body) => {
                  if (isMultiplayer && config.roomId) {
                    sendChatMessage(config.roomId, you.name, body)
                  } else {
                    setMessages((current) => [
                      ...current,
                      { id: messageId.current++, kind: 'said', author: you.name, body },
                    ])
                  }
                }}
              />
            </div>
          </div>
        </div>

        <div className="spin-area spin-area-turn fx fx-soft" style={{ animationDelay: '150ms' }}>
          <TurnIndicator
            drafters={drafters}
            active={activeSeat}
            reversed={round % 2 === 0}
            turn={overall}
            yourTurn={yourTurn}
          />
        </div>

        <div className="spin-area spin-area-narr fx fx-soft" style={{ animationDelay: '210ms' }}>
          <NarratorFeed lines={feed} />
        </div>

        <div className="spin-area spin-area-pitch fx fx-soft" style={{ animationDelay: '270ms' }}>
          <div className="spin-panel flex min-h-0 flex-1 flex-col p-[14px]">
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
      </div>

      {/* ---- Narrower than the orbit: the satellites take turns. ---- */}
      <nav className="mt-[var(--spin-gap-y)] flex shrink-0 items-center gap-[2px] border-t border-line pt-[9px] min-[1180px]:hidden">
        <PaneTab active={pane === 'wheel'} onClick={() => setPane('wheel')} className="md:hidden">{t("The wheel")}</PaneTab>
        <PaneTab active={pane === 'pool'} onClick={() => setPane('pool')}>{t("Who is left")}</PaneTab>
        <PaneTab active={pane === 'board'} onClick={() => setPane('board')}>{t("The elevens")}</PaneTab>
      </nav>
    </div>
  )
}

function PaneTab({
  active,
  onClick,
  className = '',
  children,
}: {
  active: boolean
  onClick: () => void
  className?: string
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
        className,
      ].join(' ')}
    >
      {children}
    </button>
  )
}
