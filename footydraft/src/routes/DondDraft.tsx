import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BoxGrid } from '../components/draft/BoxGrid'
import { BoxStage, type Decision } from '../components/draft/BoxStage'
import { DraftChat } from '../components/draft/DraftChat'
import { DraftClock } from '../components/draft/DraftClock'
import { DraftGate } from '../components/draft/DraftGate'
import { Narrator, type NarratorTone } from '../components/draft/Narrator'
import { PitchView } from '../components/draft/PitchView'
import { TableStrip } from '../components/draft/TableStrip'
import type { Message } from '../components/lobby/LobbyChat'
import { BackHome } from '../components/ui/BackHome'
import { LanguageSwitch } from '../components/ui/LanguageSwitch'
import { SectionLabel } from '../components/ui/SectionLabel'
import { SQUAD_SIZE, formation } from '../data/formation'
import {
  type Box,
  type RoundPlan,
  bankerOffers,
  bankerTarget,
  botSticks,
  botTakesOffer,
  drawBoxes,
  roundOrder,
  seatOrder,
} from '../lib/dondEngine'
import {
  useMultiplayerRoom,
  useHostBotTakeover,
  useActionQueue,
  updateDondState,
  placeDondAction,
  sendChatMessage,
  sendSystemMessage,
} from '../lib/multiplayer'
import { useSeats } from '../lib/seats'
import type { Drafter, Pick, Squad } from '../lib/draftEngine'
import { type Player, inScope, loadPool } from '../lib/players'
import type { DraftConfig } from './Draft'
import { SquadCompare } from './SquadCompare'
import { useI18n } from '../lib/i18n'

/** The table you get cold, matching the other three screens. */
const DEFAULT_DRAFTERS: Drafter[] = [
  { id: 'priya', name: 'Priya', kind: 'human', mark: 'P' },
  { id: 'you', name: 'You', kind: 'you', mark: 'M' },
  { id: 'bot-1', name: 'Bot 1', kind: 'bot', mark: '1' },
  { id: 'bot-2', name: 'Bot 2', kind: 'bot', mark: '2' },
]

/** Long enough to read a face and a name off the stage, short enough to sit through. */
const REVEAL_HOLD = 2100
/** How long the room reads a result before the narrator moves on. */
const REPORT_HOLD = 1600
/** The beat between a round settling and the next set of boxes arriving. */
const ROUND_HOLD = 1400

const BOT_PAUSE = [1100, 2600]
const HUMAN_PAUSE = [1800, 3800]

type Step = 'choosing' | 'revealing' | 'deciding' | 'weighing' | 'done'

interface RoundState {
  /** 1-based, and there are exactly eleven of them. */
  index: number
  boxes: Box[]
  /** Everybody opens once, then everybody who asked hears an offer. */
  stage: 'open' | 'offer'
  /** Position within `order` or `hearing`, depending on the stage. */
  cursor: number
  order: number[]
  hearing: number[]
  offers: Record<number, Player>
  step: Step
  /** Which box is on stage, while one is. */
  openedIndex: number | null
  /** The active seat went back to the boxes, so the next one they open is theirs. */
  forced: boolean
}

function activeSeatOf(state: RoundState): number {
  const list = state.stage === 'open' ? state.order : state.hearing
  return list[state.cursor] ?? -1
}

/**
 * Firebase strips nulls and empty containers, so a non-host reads back a
 * different shape from the one the host wrote — and this screen's whole turn
 * machine is keyed off exactly the fields that go missing.
 *
 * `openedIndex: null` arrives absent, so `openedIndex !== null` is *true* on
 * every client that is not the host and the stage tries to render
 * `boxes[undefined]`. `openedBy: null` on a sealed box arrives absent, so a
 * shut box reads as open and stops being clickable. `hearing: []` and
 * `offers: {}` arrive absent. Between them, a guest was watching a different
 * game from the one the host was running.
 */
function normaliseRound(raw: any): RoundState | null {
  if (!raw) return null
  return {
    index: raw.index ?? 1,
    boxes: (raw.boxes ?? []).map((box: any) => ({
      number: box.number,
      player: box.player,
      openedBy: typeof box.openedBy === 'number' ? box.openedBy : null,
    })),
    stage: raw.stage === 'offer' ? 'offer' : 'open',
    cursor: raw.cursor ?? 0,
    order: raw.order ?? [],
    hearing: raw.hearing ?? [],
    offers: raw.offers ?? {},
    step: raw.step ?? 'choosing',
    openedIndex: typeof raw.openedIndex === 'number' ? raw.openedIndex : null,
    forced: Boolean(raw.forced),
  }
}

/**
 * Deal or No Deal, drawn as layout 18 of the exhibition — the Free Pick
 * screen's own shape with a grid of sealed boxes where the pool used to be.
 *
 * What actually differs is everything underneath. There is no board to choose
 * from: a round is one designated position, `2N` boxes drawn for it, and a turn
 * is opening one and deciding whether to keep what came out or hear what the
 * banker will pay you not to. The order is a strict round robin rather than a
 * snake, there is no constraint to satisfy and no club to spend, and the same
 * eleven slots fill for everyone at the table at the same time.
 *
 * **The turn machine was rebuilt on 2026-08-23.** It used to be a set of
 * `setRound` updaters read by effects whose dependency lists were suppressed
 * and whose closures therefore went stale, mutating two pieces of state
 * (`round` and `picks`) from separate updaters that could interleave. Every
 * transition now runs through `commit` below, which reads the current round
 * out of a ref written synchronously, validates that the seat asking is the
 * seat on the clock, and writes both pieces of state together. Two actions
 * landing in the same tick — a bot timer racing a click, a duplicated remote
 * action — see each other rather than each other's history.
 */
export function DondDraft({ config }: { config: DraftConfig }) {
  const { t } = useI18n();

  const scope = config.scope ?? 'top-5'
  const league = config.league ?? 'premier-league'

  /* No clock: the bid timer is the Auction's alone — see the note where
     `timers` used to be in lobbyOptions. A round here ends when the seat on it
     sticks, takes the offer or goes back to the boxes, so there was nothing
     for a countdown to close. */

  const { room, uid } = useMultiplayerRoom(config.roomId)
  const isMultiplayer = Boolean(config.roomId)
  const isHost = isMultiplayer ? room?.host === uid : true
  useHostBotTakeover(config.roomId, isHost, room)

  const baseDrafters = config.drafters?.length ? config.drafters : DEFAULT_DRAFTERS
  const { drafters, youSeat, seated } = useSeats(baseDrafters, isMultiplayer, room, uid)

  const seatCount = drafters.length

  /* The eleven rounds are shuffled once, at the start. A position per round and
     eleven slots in a 4-2-3-1 is what makes the format self-completing. */
  const plan = useMemo<RoundPlan[]>(() => roundOrder(), [])

  const [pool, setPool] = useState<Player[]>([])
  const [poolError, setPoolError] = useState<string | null>(null)
  const [picks, setPicks] = useState<Pick[]>([])
  const [round, setRound] = useState<RoundState | null>(null)
  const [tab, setTab] = useState(0)
  const [pane, setPane] = useState<'boxes' | 'board'>('boxes')
  const [localMessages, setMessages] = useState<Message[]>([])
  const messages = useMemo(() => {
    if (isMultiplayer) {
      if (!room?.chat) return []
      return Object.values(room.chat).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
    }
    return localMessages
  }, [isMultiplayer, room?.chat, localMessages])
  const [flash, setFlash] = useState<{ text: string; tone: NarratorTone } | null>(null)

  /**
   * The round and the picks, mirrored into refs that are written **before**
   * the state they mirror.
   *
   * React batches state updates, so a transition that read `round` out of a
   * closure was reading whatever the last render had — fine for one action per
   * tick, wrong the moment a bot's timer fires alongside a click or a remote
   * action arrives while one is being applied. Writing the ref synchronously
   * makes the sequence of transitions the sequence they actually happened in.
   */
  const roundRef = useRef<RoundState | null>(null)
  const picksRef = useRef<Pick[]>([])

  const writeRound = useCallback((next: RoundState | null) => {
    roundRef.current = next
    setRound(next)
  }, [])

  const writePicks = useCallback((next: Pick[]) => {
    picksRef.current = next
    setPicks(next)
  }, [])

  // Sync state from host to clients
  useEffect(() => {
    if (!isMultiplayer || isHost) return
    if (room?.dondRound !== undefined) {
      const next = normaliseRound(room.dondRound)
      roundRef.current = next
      setRound(next)
    }
    if (room?.dondPicks !== undefined) {
      const next: Pick[] = room.dondPicks ?? []
      picksRef.current = next
      setPicks(next)
    }
  }, [isMultiplayer, isHost, room?.dondRound, room?.dondPicks])

  // Sync state from host to firebase
  useEffect(() => {
    if (isMultiplayer && isHost && config.roomId) {
      updateDondState(config.roomId, round, picks)
    }
  }, [isMultiplayer, isHost, config.roomId, round, picks])

  const messageId = useRef(1)

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
  const scopedRef = useRef(scoped)
  scopedRef.current = scoped

  /**
   * Everyone still undrafted, read off the refs so it is correct *within* a
   * transition rather than one render behind it. Box players who were never
   * claimed are in here by construction — a box only leaves the pool when
   * somebody ends a round holding it, which is exactly the
   * unopened-and-rejected return rule *(R8-Q6)* rather than a separate step
   * that has to remember to run.
   */
  const availableNow = useCallback(() => {
    const spoken = new Set(picksRef.current.map((pick) => pick.player.id))
    return scopedRef.current.filter((player) => !spoken.has(player.id))
  }, [])

  const squads = useMemo(() => {
    const built: Squad[] = drafters.map(() => ({}))
    for (const pick of picks) {
      if (built[pick.seat]) built[pick.seat][pick.slot] = pick.player
    }
    return built
  }, [picks, drafters])

  const complete = round === null ? false : round.index > SQUAD_SIZE
  const roundPlan = round && !complete ? plan[round.index - 1] : null
  const activeSeat = round && !complete && round.step !== 'done' ? activeSeatOf(round) : -1
  const yourTurn = activeSeat === youSeat

  const report = useCallback((text: string, tone: NarratorTone = 'settled') => {
    setFlash({ text, tone })
  }, [])

  useEffect(() => {
    if (!flash) return
    const timer = window.setTimeout(() => setFlash(null), REPORT_HOLD)
    return () => window.clearTimeout(timer)
  }, [flash])

  /* ------------------------------------------------------------ the rounds -- */

  const dealRound = useCallback(
    (index: number): RoundState => ({
      index,
      boxes:
        index > SQUAD_SIZE ? [] : drawBoxes(availableNow(), plan[index - 1].position, seatCount),
      stage: 'open',
      cursor: 0,
      order: seatOrder(index, seatCount),
      hearing: [],
      offers: {},
      step: index > SQUAD_SIZE ? 'done' : 'choosing',
      openedIndex: null,
      forced: false,
    }),
    [plan, seatCount, availableNow],
  )

  useEffect(() => {
    if (!ready || round !== null) return
    if (isMultiplayer && !isHost) return
    writeRound(dealRound(1))
  }, [ready, round, dealRound, isMultiplayer, isHost, writeRound])

  /**
   * A seat ends its round holding this footballer — the one way a slot fills.
   *
   * Written against the refs, so the slot comes from the round the action is
   * actually landing in rather than from whatever the last render captured,
   * and a repeat of the same action cannot produce two picks for one slot.
   */
  const keepFor = useCallback(
    (seat: number, player: Player) => {
      const state = roundRef.current
      const slot = state ? plan[state.index - 1]?.slot.id : undefined
      if (!slot) return
      if (picksRef.current.some((pick) => pick.seat === seat && pick.slot === slot)) return
      writePicks([
        ...picksRef.current,
        { overall: picksRef.current.length, seat, slot, player },
      ])
    },
    [plan, writePicks],
  )

  /**
   * One seat forward. At the end of the opening stage the banker prices the
   * round off whatever is still sealed and the offers go out; at the end of
   * the offer stage the round is over.
   */
  const advance = useCallback(
    (state: RoundState): RoundState => {
      if (state.stage === 'open') {
        const cursor = state.cursor + 1
        if (cursor < state.order.length) {
          return { ...state, cursor, step: 'choosing', openedIndex: null, forced: false }
        }
        if (state.hearing.length === 0) return { ...state, step: 'done', openedIndex: null }

        const unopened = state.boxes.filter((box) => box.openedBy === null)
        const named = bankerOffers(
          availableNow(),
          state.boxes[0]?.player.position ?? 'CM',
          state.boxes,
          bankerTarget(unopened),
          state.hearing.length,
        )

        /* **A seat the banker cannot name anybody for is not left waiting.**
           `bankerOffers` draws one distinct footballer per seat that asked
           *(R6-Q8)*, and late in a draft the pool for a position can be
           thinner than the queue — in which case those seats used to reach
           `weighing` with no offer to weigh and the round simply stopped. They
           keep the box they opened instead, which is the same outcome as
           sticking and is the only honest one: there was nothing to offer. */
        const offers: Record<number, Player> = {}
        const hearing: number[] = []
        const stranded: number[] = []
        state.hearing.forEach((seat, place) => {
          if (named[place]) {
            offers[seat] = named[place]
            hearing.push(seat)
          } else {
            stranded.push(seat)
          }
        })

        let next: RoundState = {
          ...state,
          stage: 'offer',
          cursor: 0,
          hearing,
          offers,
          step: 'weighing',
          openedIndex: null,
          forced: false,
        }

        for (const seat of stranded) {
          const box = state.boxes.find((entry) => entry.openedBy === seat)
          if (box) keepFor(seat, box.player)
        }

        if (hearing.length === 0) next = { ...next, step: 'done' }
        return next
      }

      const cursor = state.cursor + 1
      if (cursor < state.hearing.length) {
        return { ...state, cursor, step: 'weighing', openedIndex: null, forced: false }
      }
      return { ...state, step: 'done', openedIndex: null, forced: false }
    },
    [availableNow, keepFor],
  )

  /**
   * Every transition in this format, in one place.
   *
   * `seat` is who is asking. It is checked against the seat actually on the
   * clock rather than assumed — the old code applied a remote action to
   * whoever happened to be active, so a duplicated or late message opened a
   * box on somebody else's behalf.
   */
  const commit = useCallback(
    (
      seat: number,
      action:
        | { type: 'openBox'; index: number }
        | { type: 'stick' }
        | { type: 'hearOffer' }
        | { type: 'takeOffer' }
        | { type: 'backToBoxes' },
    ) => {
      const state = roundRef.current
      if (!state || state.step === 'done') return
      if (activeSeatOf(state) !== seat) return

      switch (action.type) {
        case 'openBox': {
          if (state.step !== 'choosing') return
          const box = state.boxes[action.index]
          if (!box || box.openedBy !== null) return
          writeRound({
            ...state,
            boxes: state.boxes.map((entry, at) =>
              at === action.index ? { ...entry, openedBy: seat } : entry,
            ),
            openedIndex: action.index,
            step: 'revealing',
          })
          return
        }

        case 'stick': {
          if (state.step !== 'deciding' || state.openedIndex === null) return
          const box = state.boxes[state.openedIndex]
          if (!box) return
          keepFor(seat, box.player)
          report(
            seat === youSeat
              ? t('You stuck with {player}.', { player: box.player.surname })
              : t('{name} sticks with {player}.', {
                  name: drafters[seat]?.name ?? '',
                  player: box.player.surname,
                }),
          )
          writeRound(advance(roundRef.current ?? state))
          return
        }

        case 'hearOffer': {
          if (state.step !== 'deciding') return
          writeRound(advance({ ...state, hearing: [...state.hearing, seat] }))
          return
        }

        case 'takeOffer': {
          if (state.step !== 'weighing') return
          const offer = state.offers[seat]
          if (!offer) return
          keepFor(seat, offer)
          report(
            seat === youSeat
              ? t('You took the deal — {player}.', { player: offer.name })
              : t('{name} took the deal — {player}.', {
                  name: drafters[seat]?.name ?? '',
                  player: offer.name,
                }),
          )
          writeRound(advance(roundRef.current ?? state))
          return
        }

        case 'backToBoxes': {
          if (state.step !== 'weighing') return
          if (!state.boxes.some((box) => box.openedBy === null)) return
          report(
            seat === youSeat
              ? t('You went back to the boxes.')
              : t('{name} went back to the boxes.', { name: drafters[seat]?.name ?? '' }),
            'waiting',
          )
          writeRound({ ...state, step: 'choosing', forced: true })
          return
        }
      }
    },
    [advance, keepFor, report, writeRound, drafters, youSeat, t],
  )

  /**
   * What *you* do. In multiplayer everything but the host's own move is a
   * message to the host, which is what keeps one machine authoritative.
   */
  const act = useCallback(
    (action: Parameters<typeof commit>[1]) => {
      if (youSeat < 0) return
      if (isMultiplayer && !isHost && config.roomId) {
        placeDondAction(config.roomId, youSeat, action)
        return
      }
      commit(youSeat, action)
    },
    [commit, isMultiplayer, isHost, config.roomId, youSeat],
  )

  useActionQueue(config.roomId, 'dondActions', isMultiplayer && isHost, (payload) => {
    if (typeof payload.seat !== 'number' || !payload.action) return
    commit(payload.seat, payload.action)
  })

  /* --------------------------------------------------------- what is on stage -- */

  const openedBox =
    round && round.openedIndex !== null ? (round.boxes[round.openedIndex] ?? null) : null
  const activeOffer = round && activeSeat >= 0 ? (round.offers[activeSeat] ?? null) : null

  /** Everything already out of a box this round — the read a bot is allowed. */
  const seen = useMemo(
    () => (round ? round.boxes.filter((box) => box.openedBy !== null).map((box) => box.player) : []),
    [round],
  )
  const seenRef = useRef(seen)
  seenRef.current = seen

  /* ----------------------- The turn loop. Everyone but you is simulated. ----- */

  /** Every field a transition can depend on, so no dependency list is suppressed. */
  const beatKey = round
    ? `${round.index}|${round.stage}|${round.cursor}|${round.step}|${round.openedIndex}|${round.forced}|${round.hearing.length}`
    : 'idle'

  useEffect(() => {
    const state = roundRef.current
    if (!state || complete || activeSeat < 0 || activeSeat === youSeat) return
    if (state.step !== 'choosing' && state.step !== 'deciding' && state.step !== 'weighing') return
    if (isMultiplayer && !isHost) return

    const drafter = drafters[activeSeat]
    if (!drafter) return
    /* A real person's seat is theirs to play. Only a bot — including a seat a
       bot has taken over — is simulated in a room with other people in it. */
    if (isMultiplayer && drafter.kind !== 'bot') return

    const [low, high] = drafter.kind === 'bot' ? BOT_PAUSE : HUMAN_PAUSE
    const wait = low + Math.random() * (high - low)

    const timer = window.setTimeout(() => {
      const current = roundRef.current
      if (!current || activeSeatOf(current) !== activeSeat) return

      if (current.step === 'choosing') {
        const shut = current.boxes
          .map((box, index) => ({ box, index }))
          .filter((entry) => entry.box.openedBy === null)
        if (shut.length === 0) return
        commit(activeSeat, {
          type: 'openBox',
          index: shut[Math.floor(Math.random() * shut.length)].index,
        })
        return
      }

      if (current.step === 'deciding') {
        const box = current.openedIndex === null ? null : current.boxes[current.openedIndex]
        if (!box) return
        commit(activeSeat, botSticks(box.player, seenRef.current) ? { type: 'stick' } : { type: 'hearOffer' })
        return
      }

      const offer = current.offers[activeSeat]
      if (!offer) return
      const canGoBack = current.boxes.some((box) => box.openedBy === null)
      commit(
        activeSeat,
        botTakesOffer(offer, seenRef.current) || !canGoBack
          ? { type: 'takeOffer' }
          : { type: 'backToBoxes' },
      )
    }, wait)

    return () => window.clearTimeout(timer)
  }, [beatKey, complete, activeSeat, youSeat, isHost, isMultiplayer, drafters, commit])

  /* -------------------------------------------- a box on stage, then a choice -- */

  useEffect(() => {
    const state = roundRef.current
    if (!state || state.step !== 'revealing' || state.openedIndex === null) return
    if (isMultiplayer && !isHost) return
    const box = state.boxes[state.openedIndex]
    const seat = activeSeatOf(state)
    if (!box || seat < 0) return

    const timer = window.setTimeout(() => {
      const current = roundRef.current
      if (!current || current.step !== 'revealing' || current.openedIndex === null) return

      if (current.stage === 'offer') {
        /* Back to the boxes: whatever this one held is theirs, no second
           choice — the briefing's own rule. */
        const held = current.boxes[current.openedIndex]
        if (!held) return
        keepFor(seat, held.player)
        report(
          t('{name} opened box {number} and took it.', {
            name: drafters[seat]?.name ?? '',
            number: held.number,
          }),
        )
        writeRound(advance(roundRef.current ?? current))
        return
      }

      writeRound({ ...current, step: 'deciding' })
    }, REVEAL_HOLD)

    return () => window.clearTimeout(timer)
  }, [beatKey, isHost, isMultiplayer, advance, keepFor, report, writeRound, drafters, t])

  /* ---- Nothing left to open. Should not happen against the real pool, but a
          round that stalls is worse than a round that hands out the best left. -- */

  useEffect(() => {
    const state = roundRef.current
    if (!state || complete || state.step !== 'choosing' || activeSeat < 0) return
    if (state.boxes.some((box) => box.openedBy === null)) return
    if (isMultiplayer && !isHost) return

    const position = plan[state.index - 1]?.position
    const stand = availableNow().find((player) => player.position === position)
    if (!stand) return
    keepFor(activeSeat, stand)
    report(
      t('{name} takes {player}.', {
        name: drafters[activeSeat]?.name ?? '',
        player: stand.surname,
      }),
    )
    writeRound(advance(roundRef.current ?? state))
  }, [
    beatKey,
    complete,
    activeSeat,
    isHost,
    isMultiplayer,
    plan,
    availableNow,
    keepFor,
    report,
    writeRound,
    advance,
    drafters,
    t,
  ])

  /* ------------------------------------------------------- the round turning -- */

  useEffect(() => {
    const state = roundRef.current
    if (!state || state.step !== 'done' || complete) return
    if (isMultiplayer && !isHost) return
    const next = state.index + 1

    const timer = window.setTimeout(() => {
      writeRound(dealRound(next))
      if (next <= SQUAD_SIZE) {
        const body = `Round ${next} — ${plan[next - 1].position}`
        if (isMultiplayer && config.roomId) {
          sendSystemMessage(config.roomId, body)
        } else {
          setMessages((current) => [
            ...current,
            { id: messageId.current++, kind: 'system', author: '', body },
          ])
        }
      }
    }, ROUND_HOLD)

    return () => window.clearTimeout(timer)
  }, [beatKey, complete, isMultiplayer, isHost, config.roomId, dealRound, plan, writeRound])

  useEffect(() => {
    if (!complete) return
    report(t('Every eleven is full. The draft is done.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete])

  /* ------------------------------------------------------------- the room --- */

  const tabbed = useRef(false)
  useEffect(() => {
    if (tabbed.current || youSeat < 0) return
    tabbed.current = true
    setTab(youSeat)
  }, [youSeat])

  useEffect(() => {
    if (yourTurn && youSeat >= 0) setTab(youSeat)
  }, [yourTurn, youSeat])

  /* ---------------------------------------------------------------- copy ---- */

  const live: { text: string; tone: NarratorTone } = (() => {
    if (poolError) return { text: poolError, tone: 'settled' }
    if (!ready || !round) return { text: t('Reading the board.'), tone: 'settled' }
    if (complete) return { text: t('Every eleven is full. The draft is done.'), tone: 'settled' }
    if (round.step === 'done') {
      return { text: t('Round {n} is settled.', { n: round.index }), tone: 'settled' }
    }

    const name = drafters[activeSeat]?.name ?? ''

    if (round.step === 'revealing' && openedBox) {
      return {
        text: t('Box {number} — {player}, {position}, {club}.', {
          number: openedBox.number,
          player: openedBox.player.name,
          position: t(openedBox.player.position),
          club: openedBox.player.club,
        }),
        tone: 'settled',
      }
    }
    if (round.step === 'choosing') {
      if (yourTurn) {
        return {
          text: round.forced ? t('Whatever you open, you take.') : t('Choose a box.'),
          tone: 'you',
        }
      }
      return { text: t('{name} is choosing a box.', { name }), tone: 'waiting' }
    }
    if (round.step === 'deciding') {
      if (yourTurn) return { text: t('Stick, or hear the offer.'), tone: 'you' }
      return { text: t('{name} is deciding.', { name }), tone: 'waiting' }
    }
    if (yourTurn && activeOffer) {
      return { text: t('The banker offers {player}.', { player: activeOffer.name }), tone: 'you' }
    }
    return { text: t('The banker has made {name} an offer.', { name }), tone: 'waiting' }
  })()

  const narration = flash ?? live
  const beat = useRef(0)
  const spoken = useRef('')
  if (spoken.current !== narration.text) {
    spoken.current = narration.text
    beat.current += 1
  }

  /* --------------------------------------------------------------- the stage -- */

  const canGoBack = Boolean(round?.boxes.some((box) => box.openedBy === null))

  const stage: {
    player: Player
    label: string
    accent: boolean
    decisions: Decision[]
    note: string | null
  } | null = (() => {
    if (!round || complete) return null

    if (round.step === 'weighing' && activeOffer) {
      const mine = yourTurn
      return {
        player: activeOffer,
        label: t('The banker offers'),
        accent: true,
        decisions: mine
          ? [
              ...(canGoBack
                ? [{ label: t('Back to the boxes'), onChoose: () => act({ type: 'backToBoxes' }) }]
                : []),
              {
                label: t('Take it'),
                primary: true,
                onChoose: () => act({ type: 'takeOffer' }),
              },
            ]
          : [],
        note: mine
          ? canGoBack
            ? t('Go back and the next box you open is yours, whatever it holds.')
            : t('Nothing left to go back to.')
          : null,
      }
    }

    if (!openedBox) return null
    const mine = openedBox.openedBy === youSeat
    const opener = drafters[openedBox.openedBy ?? 0]?.name ?? ''

    return {
      player: openedBox.player,
      label: t('Box {number} · {whose}', {
        number: String(openedBox.number).padStart(2, '0'),
        whose: mine ? t('yours') : opener,
      }),
      accent: mine,
      decisions:
        round.step === 'deciding' && yourTurn
          ? [
              { label: t('Hear the offer'), onChoose: () => act({ type: 'hearOffer' }) },
              {
                label: t('Stick with {player}', { player: openedBox.player.surname }),
                primary: true,
                onChoose: () => act({ type: 'stick' }),
              },
            ]
          : [],
      note: null,
    }
  })()

  /* ---------------------------------------------------------------- the rest -- */

  const shut = round ? round.boxes.filter((box) => box.openedBy === null).length : 0

  /**
   * Where this round's slot is on **your** pitch, and the footballer heading
   * for it — but only while the thing on stage is actually yours. It used to
   * preview whatever was on stage on your own board, which meant somebody
   * else's box appeared in your eleven for as long as they were looking at it.
   */
  const yoursOnStage =
    yourTurn &&
    Boolean(stage) &&
    (round?.step === 'deciding' || round?.step === 'weighing')

  const pendingSlot = yoursOnStage
    ? (formation.find((slot) => slot.id === roundPlan?.slot.id) ?? null)
    : null

  /**
   * The line under the boxes says what is at stake, never what the narrator
   * has already said — two identical sentences on one screen read as a fault
   * rather than as emphasis.
   */
  const reason = (() => {
    if (poolError) return poolError
    if (!ready || !roundPlan) return t('Reading the board…')
    if (complete) return t('Every eleven is full.')
    if (round?.step === 'done') return t('Round {n} is settled.', { n: round.index })
    if (!yourTurn) {
      return t('Waiting on {name}.', {
        name: drafters[activeSeat]?.name ?? t('the table'),
      })
    }
    if (round?.forced) {
      return t('The next box you open fills your {position}.', {
        position: t(roundPlan.position),
      })
    }
    return t('Whatever you end this round holding fills your {position}.', {
      position: t(roundPlan.position),
    })
  })()

  const you = drafters[youSeat]
  const lastArrival = picks[picks.length - 1]?.player.id ?? null

  /* Nothing below this line is safe to draw without a seat — see `DraftGate`. */
  if (!seated || !you) return <DraftGate />

  if (complete) {
    return <SquadCompare drafters={drafters} squads={squads} />
  }

  return (
    <div className="draft dond flex h-full w-full flex-col px-[var(--app-inset-x)] py-[var(--app-inset-y)]">
      {/* ---- The way out, the narrator, and the table it is talking about. ---- */}
      <div className="fx fx-soft flex shrink-0 flex-col items-stretch gap-[10px] border-b border-line py-[12px] sm:flex-row sm:items-center sm:gap-5">
        <div className="flex shrink-0 items-center gap-3">
          <BackHome confirm />
          <LanguageSwitch className="hidden sm:flex" />
        </div>

        <div className="flex min-w-0 flex-1 justify-center">
          <Narrator text={narration.text} tone={narration.tone} beat={beat.current} />
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
          <DraftClock round={Math.min(round?.index ?? 1, SQUAD_SIZE)} rounds={SQUAD_SIZE} />

          <section className="flex shrink-0 flex-col gap-[10px]">
            <SectionLabel>{t('This round fills')}</SectionLabel>
            <span className="dond-position font-display font-medium uppercase leading-[0.82] text-accent">
              {roundPlan ? t(roundPlan.position) : '—'}
            </span>
          </section>

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

        <div
          className={[
            'fx fx-soft min-h-0 flex-col pt-[22px] min-[1180px]:flex min-[1180px]:border-l min-[1180px]:border-line min-[1180px]:px-[30px] md:flex md:pr-[30px]',
            pane === 'boxes' ? 'flex' : 'hidden',
          ].join(' ')}
          style={{ animationDelay: '150ms' }}
        >
          <div className="flex shrink-0 items-baseline justify-between gap-4">
            <SectionLabel>{t('The boxes')}</SectionLabel>
            <span className="tabular font-display text-[10px] font-medium uppercase tracking-[0.16em] text-dim">
              {t('{count} still shut', { count: shut })}
            </span>
          </div>

          <div className="relative mt-[14px] flex min-h-0 flex-1 flex-col">
            {round && round.boxes.length > 0 ? (
              <BoxGrid
                boxes={round.boxes}
                drafters={drafters}
                youSeat={youSeat}
                onOpen={
                  yourTurn && round.step === 'choosing'
                    ? (index) => act({ type: 'openBox', index })
                    : null
                }
              />
            ) : (
              <p className="m-auto text-[11.5px] text-dim">{reason}</p>
            )}

            {stage ? (
              <BoxStage
                key={`${stage.label}-${stage.player.id}`}
                player={stage.player}
                label={stage.label}
                accent={stage.accent}
                decisions={stage.decisions}
                note={stage.note}
              />
            ) : null}
          </div>

          <div className="mt-[14px] shrink-0 border-t border-line pt-[10px]">
            <p className="truncate text-[11.5px] leading-[1.4] text-dim">{reason}</p>
          </div>
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
            preview={tab === youSeat && yoursOnStage ? (stage?.player ?? null) : null}
            lastArrival={lastArrival}
          />
        </div>
      </div>

      {/* ---- One viewport, one column: the two halves take turns. ---- */}
      <div className="mt-[12px] flex shrink-0 items-center gap-[2px] border-t border-line pt-[10px] md:hidden">
        <PaneTab active={pane === 'boxes'} onClick={() => setPane('boxes')}>{t('The boxes')}</PaneTab>
        <PaneTab active={pane === 'board'} onClick={() => setPane('board')}>{t('The elevens')}</PaneTab>
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
