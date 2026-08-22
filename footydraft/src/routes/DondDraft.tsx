import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BoxGrid } from '../components/draft/BoxGrid'
import { BoxStage, type Decision } from '../components/draft/BoxStage'
import { DraftChat } from '../components/draft/DraftChat'
import { DraftClock } from '../components/draft/DraftClock'
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
import type { Drafter, Pick, Squad } from '../lib/draftEngine'
import { type Player, inScope, loadPool } from '../lib/players'
import type { DraftConfig } from './Draft'
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

const CHATTER = [
  'take the deal',
  'no chance, stick',
  'that box was mine',
  'the banker is robbing you',
  'i would have opened four',
  'good box',
]

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
 * Deal or No Deal, drawn as layout 18 of the exhibition — the Free Pick
 * screen's own shape with a grid of sealed boxes where the pool used to be.
 *
 * What actually differs is everything underneath. There is no board to choose
 * from: a round is one designated position, `2N` boxes drawn for it, and a turn
 * is opening one and deciding whether to keep what came out or hear what the
 * banker will pay you not to. The order is a strict round robin rather than a
 * snake, there is no constraint to satisfy and no club to spend, and the same
 * eleven slots fill for everyone at the table at the same time.
 */
export function DondDraft({ config }: { config: DraftConfig }) {
  const { t } = useI18n();

  const scope = config.scope ?? 'top-5'
  const league = config.league ?? 'premier-league'

  /* No clock: the bid timer is the Auction's alone — see the note on `timers`
     in lobbyOptions. A round here ends when the seat on it sticks, takes the
     offer or goes back to the boxes, so there was nothing for a countdown to
     close. The least-committal auto-choices it used to force are gone with it. */

  const drafters = config.drafters?.length ? config.drafters : DEFAULT_DRAFTERS
  const seatCount = drafters.length
  const youSeat = Math.max(0, drafters.findIndex((drafter) => drafter.kind === 'you'))

  /* The eleven rounds are shuffled once, at the start. A position per round and
     eleven slots in a 4-2-3-1 is what makes the format self-completing. */
  const plan = useMemo<RoundPlan[]>(() => roundOrder(), [])

  const [pool, setPool] = useState<Player[]>([])
  const [poolError, setPoolError] = useState<string | null>(null)
  const [picks, setPicks] = useState<Pick[]>([])
  const [round, setRound] = useState<RoundState | null>(null)
  const [tab, setTab] = useState(youSeat)
  const [pane, setPane] = useState<'boxes' | 'board'>('boxes')
  const [messages, setMessages] = useState<Message[]>([])
  const [flash, setFlash] = useState<{ text: string; tone: NarratorTone } | null>(null)

  const messageId = useRef(1)

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
  const ready = scoped.length > 0

  const taken = useMemo(() => new Set(picks.map((pick) => pick.player.id)), [picks])

  /**
   * Everyone still undrafted. Box players who were never claimed are in here by
   * construction — a box only leaves the pool when somebody ends a round
   * holding it, which is exactly the unopened-and-rejected return rule
   * *(R8-Q6)* rather than a separate step that has to remember to run.
   */
  const available = useMemo(
    () => scoped.filter((player) => !taken.has(player.id)),
    [scoped, taken],
  )
  const availableRef = useRef(available)
  availableRef.current = available

  const squads = useMemo(() => {
    const built: Squad[] = drafters.map(() => ({}))
    for (const pick of picks) built[pick.seat][pick.slot] = pick.player
    return built
  }, [picks, drafters])

  const complete = round === null ? false : round.index > SQUAD_SIZE
  const roundPlan = round && !complete ? plan[round.index - 1] : null
  const activeSeat = round && !complete && round.step !== 'done' ? activeSeatOf(round) : -1
  const yourTurn = activeSeat === youSeat

  /* ------------------------------------------------------------ the rounds -- */

  const dealRound = useCallback(
    (index: number): RoundState => ({
      index,
      boxes:
        index > SQUAD_SIZE
          ? []
          : drawBoxes(availableRef.current, plan[index - 1].position, seatCount),
      stage: 'open',
      cursor: 0,
      order: seatOrder(index, seatCount),
      hearing: [],
      offers: {},
      step: index > SQUAD_SIZE ? 'done' : 'choosing',
      openedIndex: null,
      forced: false,
    }),
    [plan, seatCount],
  )

  useEffect(() => {
    if (!ready || round !== null) return
    setRound(dealRound(1))
  }, [ready, round, dealRound])

  /**
   * One seat forward. At the end of the opening stage the banker prices the
   * round off whatever is still sealed and the offers go out; at the end of
   * the offer stage the round is over.
   */
  const advance = useCallback((state: RoundState): RoundState => {
    if (state.stage === 'open') {
      const cursor = state.cursor + 1
      if (cursor < state.order.length) {
        return { ...state, cursor, step: 'choosing', openedIndex: null }
      }
      if (state.hearing.length === 0) return { ...state, step: 'done', openedIndex: null }

      const unopened = state.boxes.filter((box) => box.openedBy === null)
      const named = bankerOffers(
        availableRef.current,
        state.boxes[0]?.player.position ?? 'CM',
        state.boxes,
        bankerTarget(unopened),
        state.hearing.length,
      )
      const offers: Record<number, Player> = {}
      state.hearing.forEach((seat, place) => {
        if (named[place]) offers[seat] = named[place]
      })

      return { ...state, stage: 'offer', cursor: 0, step: 'weighing', openedIndex: null, offers }
    }

    const cursor = state.cursor + 1
    if (cursor < state.hearing.length) {
      return { ...state, cursor, step: 'weighing', openedIndex: null, forced: false }
    }
    return { ...state, step: 'done', openedIndex: null, forced: false }
  }, [])

  const report = useCallback((text: string, tone: NarratorTone = 'settled') => {
    setFlash({ text, tone })
  }, [])

  useEffect(() => {
    if (!flash) return
    const timer = window.setTimeout(() => setFlash(null), REPORT_HOLD)
    return () => window.clearTimeout(timer)
  }, [flash])

  /** A seat ends its round holding this footballer. The one way a slot fills. */
  const settle = useCallback(
    (seat: number, player: Player, line: string) => {
      const slot = plan[(round?.index ?? 1) - 1]?.slot.id
      if (!slot) return
      setPicks((previous) =>
        previous.some((pick) => pick.seat === seat && pick.slot === slot)
          ? previous
          : [...previous, { overall: previous.length, seat, slot, player }],
      )
      report(line)
      setRound((previous) => (previous ? advance(previous) : previous))
    },
    [plan, round?.index, advance, report],
  )

  const openBox = useCallback((index: number) => {
    setRound((previous) => {
      if (!previous || previous.step !== 'choosing') return previous
      if (previous.boxes[index]?.openedBy !== null) return previous
      const seat = activeSeatOf(previous)
      return {
        ...previous,
        boxes: previous.boxes.map((box, at) => (at === index ? { ...box, openedBy: seat } : box)),
        openedIndex: index,
        step: 'revealing',
      }
    })
  }, [])

  const hearOffer = useCallback(() => {
    setRound((previous) => {
      if (!previous || previous.step !== 'deciding') return previous
      const seat = activeSeatOf(previous)
      return advance({ ...previous, hearing: [...previous.hearing, seat] })
    })
  }, [advance])

  const backToBoxes = useCallback(() => {
    setRound((previous) =>
      previous && previous.step === 'weighing'
        ? { ...previous, step: 'choosing', forced: true }
        : previous,
    )
  }, [])

  /* --------------------------------------------------------- what is on stage -- */

  const openedBox = round?.openedIndex !== null && round ? round.boxes[round.openedIndex] : null
  const activeOffer = round && activeSeat >= 0 ? (round.offers[activeSeat] ?? null) : null

  /** Everything already out of a box this round — the read a bot is allowed. */
  const seen = useMemo(
    () => (round ? round.boxes.filter((box) => box.openedBy !== null).map((box) => box.player) : []),
    [round],
  )
  const seenRef = useRef(seen)
  seenRef.current = seen

  /* ----------------------- The turn loop. Everyone but you is simulated. ----- */

  const beatKey = round ? `${round.index}-${round.stage}-${round.cursor}-${round.step}` : 'idle'

  useEffect(() => {
    if (!round || complete || activeSeat < 0 || activeSeat === youSeat) return
    if (round.step !== 'choosing' && round.step !== 'deciding' && round.step !== 'weighing') return

    const drafter = drafters[activeSeat]
    const [low, high] = drafter.kind === 'bot' ? BOT_PAUSE : HUMAN_PAUSE
    const wait = low + Math.random() * (high - low)

    const timer = window.setTimeout(() => {
      if (round.step === 'choosing') {
        const shut = round.boxes
          .map((box, index) => ({ box, index }))
          .filter((entry) => entry.box.openedBy === null)
        if (shut.length === 0) return
        openBox(shut[Math.floor(Math.random() * shut.length)].index)
        return
      }

      if (round.step === 'deciding') {
        const box = round.openedIndex === null ? null : round.boxes[round.openedIndex]
        if (!box) return
        if (botSticks(box.player, seenRef.current)) {
          settle(activeSeat, box.player, `${drafter.name} sticks with ${box.player.surname}.`)
        } else {
          hearOffer()
        }
        return
      }

      const offer = round.offers[activeSeat]
      if (!offer) return
      if (botTakesOffer(offer, seenRef.current)) {
        settle(activeSeat, offer, `${drafter.name} took the deal — ${offer.name}.`)
      } else {
        report(`${drafter.name} went back to the boxes.`, 'waiting')
        backToBoxes()
      }
    }, wait)

    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beatKey, complete, activeSeat, youSeat])

  /* -------------------------------------------- a box on stage, then a choice -- */

  useEffect(() => {
    if (!round || round.step !== 'revealing' || round.openedIndex === null) return
    const box = round.boxes[round.openedIndex]
    const seat = activeSeatOf(round)
    if (!box || seat < 0) return

    const timer = window.setTimeout(() => {
      if (round.stage === 'offer') {
        // Back to the boxes: whatever this one held is theirs, no second choice.
        settle(seat, box.player, `${drafters[seat].name} opened box ${box.number} and took it.`)
        return
      }
      setRound((previous) =>
        previous && previous.step === 'revealing' ? { ...previous, step: 'deciding' } : previous,
      )
    }, REVEAL_HOLD)

    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beatKey, round?.openedIndex])

  /* ---- Nothing left to open. Should not happen against the real pool, but a
          round that stalls is worse than a round that hands out the best left. -- */

  useEffect(() => {
    if (!round || complete || round.step !== 'choosing' || activeSeat < 0) return
    if (round.boxes.some((box) => box.openedBy === null)) return
    const position = roundPlan?.position
    const stand = availableRef.current.find((player) => player.position === position)
    if (!stand) return
    settle(activeSeat, stand, `${drafters[activeSeat].name} takes ${stand.surname}.`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beatKey, complete, activeSeat])

  /* ------------------------------------------------------- the round turning -- */

  useEffect(() => {
    if (!round || round.step !== 'done' || complete) return
    const next = round.index + 1

    const timer = window.setTimeout(() => {
      setRound(dealRound(next))
      if (next <= SQUAD_SIZE) {
        setMessages((current) => [
          ...current,
          {
            id: messageId.current++,
            kind: 'system',
            author: '',
            body: `Round ${next} — ${plan[next - 1].position}`,
          },
        ])
      }
    }, ROUND_HOLD)

    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beatKey, complete])

  useEffect(() => {
    if (!complete) return
    report('Every eleven is full. The draft is done.')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete])

  /* ------------------------------------------------------------- the room --- */

  const chattered = useRef('')
  useEffect(() => {
    if (!round || round.step !== 'deciding' || activeSeat === youSeat) return
    if (chattered.current === beatKey) return
    chattered.current = beatKey
    if (Math.random() > 0.3) return

    const speaker = drafters[(activeSeat + 1) % seatCount]
    const timer = window.setTimeout(() => {
      setMessages((current) => [
        ...current,
        {
          id: messageId.current++,
          kind: 'said',
          author: speaker.name,
          body: CHATTER[Math.floor(Math.random() * CHATTER.length)],
        },
      ])
    }, 800)

    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beatKey, activeSeat, youSeat])

  useEffect(() => {
    if (yourTurn) setTab(youSeat)
  }, [yourTurn, youSeat])

  /* ---------------------------------------------------------------- copy ---- */

  const live: { text: string; tone: NarratorTone } = (() => {
    if (poolError) return { text: poolError, tone: 'settled' }
    if (!ready || !round) return { text: 'Reading the board.', tone: 'settled' }
    if (complete) return { text: 'Every eleven is full. The draft is done.', tone: 'settled' }
    if (round.step === 'done') return { text: `Round ${round.index} is settled.`, tone: 'settled' }

    const name = drafters[activeSeat]?.name ?? ''

    if (round.step === 'revealing' && openedBox) {
      return {
        text: `Box ${openedBox.number} — ${openedBox.player.name}, ${openedBox.player.position}, ${openedBox.player.club}.`,
        tone: 'settled',
      }
    }
    if (round.step === 'choosing') {
      if (yourTurn) {
        return {
          text: round.forced ? 'Whatever you open, you take.' : 'Choose a box.',
          tone: 'you',
        }
      }
      return { text: `${name} is choosing a box.`, tone: 'waiting' }
    }
    if (round.step === 'deciding') {
      if (yourTurn) return { text: 'Stick, or hear the offer.', tone: 'you' }
      return { text: `${name} is deciding.`, tone: 'waiting' }
    }
    if (yourTurn && activeOffer) {
      return { text: `The banker offers ${activeOffer.name}.`, tone: 'you' }
    }
    return { text: `The banker has made ${name} an offer.`, tone: 'waiting' }
  })()

  const narration = flash ?? live
  const beat = useRef(0)
  const spoken = useRef('')
  if (spoken.current !== narration.text) {
    spoken.current = narration.text
    beat.current += 1
  }

  /* --------------------------------------------------------------- the stage -- */

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
        label: 'The banker offers',
        accent: true,
        decisions: mine
          ? [
              {
                label: 'Back to the boxes',
                onChoose: backToBoxes,
              },
              {
                label: 'Take it',
                primary: true,
                onChoose: () =>
                  settle(youSeat, activeOffer, `You took the deal — ${activeOffer.name}.`),
              },
            ]
          : [],
        note: mine ? 'Go back and the next box you open is yours, whatever it holds.' : null,
      }
    }

    if (!openedBox) return null
    const mine = openedBox.openedBy === youSeat
    const opener = drafters[openedBox.openedBy ?? 0]?.name ?? ''

    return {
      player: openedBox.player,
      label: `Box ${String(openedBox.number).padStart(2, '0')} · ${mine ? 'yours' : opener}`,
      accent: mine,
      decisions:
        round.step === 'deciding' && yourTurn
          ? [
              { label: 'Hear the offer', onChoose: hearOffer },
              {
                label: `Stick with ${openedBox.player.surname}`,
                primary: true,
                onChoose: () =>
                  settle(
                    youSeat,
                    openedBox.player,
                    `You stuck with ${openedBox.player.surname}.`,
                  ),
              },
            ]
          : [],
      note: null,
    }
  })()

  /* ---------------------------------------------------------------- the rest -- */

  const shut = round ? round.boxes.filter((box) => box.openedBy === null).length : 0

  const pendingSlot =
    yourTurn && stage && (round?.step === 'deciding' || round?.step === 'weighing')
      ? (formation.find((slot) => slot.id === roundPlan?.slot.id) ?? null)
      : null

  /**
   * The line under the boxes says what is at stake, never what the narrator
   * has already said — two identical sentences on one screen read as a fault
   * rather than as emphasis.
   */
  const reason = (() => {
    if (poolError) return poolError
    if (!ready || !roundPlan) return 'Reading the board…'
    if (complete) return 'Every eleven is full.'
    if (round?.step === 'done') return `Round ${round.index} is settled.`
    if (!yourTurn) return `Waiting on ${drafters[activeSeat]?.name ?? 'the table'}.`
    if (round?.forced) return `The next box you open fills your ${roundPlan.position}.`
    return `Whatever you end this round holding fills your ${roundPlan.position}.`
  })()

  const you = drafters[youSeat]
  const lastArrival = picks[picks.length - 1]?.player.id ?? null

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
            <SectionLabel>{t("This round fills")}</SectionLabel>
            <span className="dond-position font-display font-medium uppercase leading-[0.82] text-accent">
              {roundPlan?.position ?? '—'}
            </span>
          </section>

          <DraftChat
            messages={messages}
            you={you.name}
            onSend={(body) =>
              setMessages((current) => [
                ...current,
                { id: messageId.current++, kind: 'said', author: you.name, body },
              ])
            }
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
            <SectionLabel>{t("The boxes")}</SectionLabel>
            <span className="tabular font-display text-[10px] font-medium uppercase tracking-[0.16em] text-dim">
              {shut} still shut
            </span>
          </div>

          <div className="relative mt-[14px] flex min-h-0 flex-1 flex-col">
            {round && round.boxes.length > 0 ? (
              <BoxGrid
                boxes={round.boxes}
                drafters={drafters}
                youSeat={youSeat}
                onOpen={yourTurn && round.step === 'choosing' ? openBox : null}
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
            preview={tab === youSeat ? (stage?.player ?? null) : null}
            lastArrival={lastArrival}
          />
        </div>
      </div>

      {/* ---- One viewport, one column: the two halves take turns. ---- */}
      <div className="mt-[12px] flex shrink-0 items-center gap-[2px] border-t border-line pt-[10px] md:hidden">
        <PaneTab active={pane === 'boxes'} onClick={() => setPane('boxes')}>{t("The boxes")}</PaneTab>
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
