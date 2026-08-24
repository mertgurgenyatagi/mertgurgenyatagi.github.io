import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AuctionBlock, type BlockResult } from '../components/draft/AuctionBlock'
import { BidBoard } from '../components/draft/BidBoard'
import { DraftChat } from '../components/draft/DraftChat'
import { DraftGate } from '../components/draft/DraftGate'
import { Dotgrid } from '../components/draft/Dotgrid'
import { PitchView } from '../components/draft/PitchView'
import { SoldRecord } from '../components/draft/SoldRecord'
import { TableStrip } from '../components/draft/TableStrip'
import type { Message } from '../components/lobby/LobbyChat'
import { BackHome } from '../components/ui/BackHome'
import { Crest } from '../components/ui/Crest'
import { LanguageSwitch } from '../components/ui/LanguageSwitch'
import { SectionLabel } from '../components/ui/SectionLabel'
import { SQUAD_SIZE, formation } from '../data/formation'
import {
  AUCTION_BID_SECONDS,
  type Lot,
  type Sale,
  auctionExhausted,
  buildLotList,
  landingSlot,
  lotIsDecided,
  startingBudget,
  weakestFor,
} from '../lib/auctionEngine'
import {
  useMultiplayerRoom,
  useActionQueue,
  updateAuctionState,
  placeAuctionBid,
  placeAuctionPass,
  sendChatMessage,
} from '../lib/multiplayer'
import { useSeats } from '../lib/seats'
import type { Drafter, Pick, Squad } from '../lib/draftEngine'
import { type Player, inScope, loadPool } from '../lib/players'
import type { DraftConfig } from './Draft'
import { SquadCompare } from './SquadCompare'
import { useI18n } from '../lib/i18n'

/** The table you get cold, matching the other three screens. */
const DEFAULT_DRAFTERS: Drafter[] = [
  { id: 'you', name: 'You', kind: 'you', mark: 'M' },
  { id: 'priya', name: 'Priya', kind: 'human', mark: 'P' },
  { id: 'sam', name: 'Sam', kind: 'human', mark: 'S' },
]

/** How long the hammer holds on screen before the next lot comes up. */
const RESULT_HOLD = 1900

/**
 * **Nobody may bid for the first three seconds of a countdown** — and the
 * countdown restarts on every bid, so this is a cooling-off period after each
 * raise rather than a one-off at the top of a lot.
 *
 * It applies to the room exactly as it applies to you: every seat reads the
 * same flag, so a lot cannot be walked up by two bidders trading raises
 * faster than anybody can read them. What it buys is a beat to look at the
 * footballer and at what they are being held at before deciding, which is the
 * only decision this format has.
 */
const LOCKOUT_MS = 500

type Phase = 'live' | 'sold' | 'unsold'

export interface Block {
  lot: Lot
  /** The opening price until somebody takes it, then whatever it is held at. */
  price: number
  holder: number | null
  bids: Record<number, number>
  /** Seats out of this lot — priced out, or passed by hand. Final either way. */
  out: number[]
  phase: Phase
  /** Bumped by every bid, which is what sends the countdown back to full. */
  resets: number
}

/**
 * Firebase drops every null and every empty container on the way in, so what
 * a non-host reads back is not the object the host wrote: `holder: null`
 * arrives as *absent*, `bids: {}` and `out: []` arrive as absent, and
 * `crest: null` on the footballer arrives as absent too.
 *
 * That is not a cosmetic difference. `holder !== null` is what the whole
 * screen keys off — it decides whether the steps read `+5 / +10 / +25` or
 * collapse to the single opening bid, and whether the headline says `OPENING`
 * or names a holder. With `holder` undefined it is *always* true on a
 * non-host, which is exactly the pair of faults reported: a guest never got
 * the `Open the bidding` control, and the headline read `HIGHEST BIDDER: SEAT
 * UNDEFINED` before anybody had bid.
 *
 * Every read of the room goes through here, so the shape a client holds is
 * the shape the host wrote rather than the shape the wire allowed.
 */
function normaliseBlock(raw: any): Block | null {
  if (!raw || !raw.lot) return null
  return {
    lot: raw.lot,
    price: raw.price ?? raw.lot.opening ?? 0,
    holder: typeof raw.holder === 'number' ? raw.holder : null,
    bids: raw.bids ?? {},
    out: raw.out ?? [],
    phase: raw.phase ?? 'live',
    resets: raw.resets ?? 0,
  }
}

/**
 * Same treatment for the sold record. An unsold lot is `seat: null`, which
 * comes back absent — and `sale.seat !== null` then passed `undefined`
 * straight into `award()` and `drafters[...]`, which is one of the ways a
 * non-host's screen went black mid-auction.
 */
function normaliseSales(raw: any): Sale[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter(Boolean)
    .map((sale: any) => ({
      lot: sale.lot,
      player: sale.player,
      seat: typeof sale.seat === 'number' ? sale.seat : null,
      price: sale.price ?? 0,
    }))
    .filter((sale) => Boolean(sale.player))
}

/**
 * The Auction, drawn as layout 01 of the exhibition — "The block".
 *
 * The lot is the page. One unbroken centre column runs the count, the
 * footballer, the countdown and the drafters bidding side by side, with what
 * has already gone down the left and the elevens on the right.
 *
 * What makes it a different screen from the other three, rather than the same
 * screen with money on it: **there is no turn.** Every seat can raise at any
 * moment, the increments are live for everyone at once, and the clock measures
 * inactivity rather than anybody's window — any bid sends it back to full and a
 * lot sells when the clock runs out on it. So there is no turn indicator here,
 * and no turn language: what the screen shows instead is a *holder*.
 *
 * There is also no narrator. Events are drawn rather than described — the
 * hammer lands across the photograph, the sold record keeps the history, and
 * the headline across the top carries the present tense. Nothing on this
 * screen is a sentence.
 */
export function AuctionDraft({ config }: { config: DraftConfig }) {
  const { t } = useI18n();

  const scope = config.scope ?? 'top-5'
  const league = config.league ?? 'premier-league'
  /* The bid timer stopped being a setting on 2026-08-23 — see the note where
     `timers` used to be in lobbyOptions. It never had a coherent "off". */
  const limit = AUCTION_BID_SECONDS

  const { room, uid } = useMultiplayerRoom(config.roomId)
  const isMultiplayer = Boolean(config.roomId)
  const isHost = isMultiplayer ? room?.host === uid : true

  const baseDrafters = config.drafters?.length ? config.drafters : DEFAULT_DRAFTERS
  const { drafters, youSeat, seated } = useSeats(baseDrafters, isMultiplayer, room, uid)

  const seatCount = drafters.length

  const [pool, setPool] = useState<Player[]>([])
  const [poolError, setPoolError] = useState<string | null>(null)
  const [lots, setLots] = useState<Lot[]>([])
  const [cursor, setCursor] = useState(0)
  const [block, setBlock] = useState<Block | null>(null)
  const [sales, setSales] = useState<Sale[]>([])
  const [finished, setFinished] = useState(false)

  // Sync state from host to clients
  useEffect(() => {
    if (!isMultiplayer || isHost) return
    if (room?.auctionBlock !== undefined) setBlock(normaliseBlock(room.auctionBlock))
    if (room?.auctionSales !== undefined) setSales(normaliseSales(room.auctionSales))
  }, [isMultiplayer, isHost, room?.auctionBlock, room?.auctionSales])

  // Sync state from host to firebase
  useEffect(() => {
    if (isMultiplayer && isHost && config.roomId) {
      updateAuctionState(config.roomId, block, sales)
    }
  }, [isMultiplayer, isHost, config.roomId, block, sales])

  /**
   * The countdown, stamped with the lot-and-bid it belongs to.
   *
   * Not a bare number: a lot closes on its clock reaching zero, and a new lot
   * renders once before its own clock effect has run — so a plain `seconds`
   * would still be holding the *previous* lot's zero at that moment and hammer
   * the new one down unsold before anybody had seen it. Carrying the key with
   * the value makes that state unrepresentable rather than merely unlikely.
   */
  const [clock, setClock] = useState<{ key: number; left: number }>({ key: -1, left: limit })
  /** False for the first `LOCKOUT_MS` of every countdown — see the note above. */
  const [armed, setArmed] = useState(false)
  const [tab, setTab] = useState(0)
  const [pane, setPane] = useState<'block' | 'board'>('block')
  const [localMessages, setMessages] = useState<Message[]>([])
  const messages = useMemo(() => {
    if (isMultiplayer) {
      if (!room?.chat) return []
      return Object.values(room.chat).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
    }
    return localMessages
  }, [isMultiplayer, room?.chat, localMessages])
  const [lastArrival, setLastArrival] = useState<string | null>(null)

  /* Your own board opens on your own tab, once there is a seat to open on. */
  const tabbed = useRef(false)
  useEffect(() => {
    if (tabbed.current || youSeat < 0) return
    tabbed.current = true
    setTab(youSeat)
  }, [youSeat])

  /* Purchases, and the spares that had nowhere to go. A buy lands straight in
     an open slot; only when every slot for that position is full does it
     overflow *(R7.2-Q1)*. */
  const [board, setBoard] = useState<{ picks: Pick[]; spare: Player[][] }>(() => ({
    picks: [],
    spare: [],
  }))

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
  const scopedRef = useRef(scoped)
  scopedRef.current = scoped

  const startBudget = useMemo(() => startingBudget(scoped), [scoped])

  useEffect(() => {
    if (scoped.length === 0 || lots.length > 0) return
    setLots(buildLotList(scoped, seatCount))
  }, [scoped, seatCount, lots.length])

  /* --------------------------------------------------------- what is owned -- */

  const squads = useMemo(() => {
    const built: Squad[] = drafters.map(() => ({}))
    for (const pick of board.picks) {
      if (built[pick.seat]) built[pick.seat][pick.slot] = pick.player
    }
    return built
  }, [board.picks, drafters])

  const budgets = useMemo(() => {
    const left = drafters.map(() => startBudget)
    for (const sale of sales) {
      if (sale.seat !== null && left[sale.seat] !== undefined) left[sale.seat] -= sale.price
    }
    return left
  }, [sales, drafters, startBudget])

  /** The bidding loop reads these several times a second; state would go stale. */
  const live = useRef({ squads, budgets, block, armed, sales, drafters })
  live.current = { squads, budgets, block, armed, sales, drafters }

  const award = useCallback((seat: number, player: Player) => {
    setBoard((previous) => {
      const squad: Squad = {}
      for (const pick of previous.picks) if (pick.seat === seat) squad[pick.slot] = pick.player

      const slot = landingSlot(player, squad)
      if (slot) {
        return {
          ...previous,
          picks: [...previous.picks, { overall: previous.picks.length, seat, slot, player }],
        }
      }

      /* `spare` is grown to reach the seat rather than mapped over: the seat
         table can arrive after this state was initialised, and a `map` over a
         shorter array would silently drop the purchase. */
      const spare = [...previous.spare]
      while (spare.length <= seat) spare.push([])
      spare[seat] = [...spare[seat], player]
      return { ...previous, spare }
    })
    setLastArrival(player.id)
  }, [])

  const salesProcessed = useRef(0)
  useEffect(() => {
    if (sales.length > salesProcessed.current) {
      for (let i = salesProcessed.current; i < sales.length; i++) {
        const sale = sales[i]
        if (sale.seat !== null) award(sale.seat, sale.player)
      }
      salesProcessed.current = sales.length
    }
  }, [sales, award])

  /**
   * The graveyard swap: a spare goes into its slot and whoever was holding it
   * comes back out. A straight two-way exchange *(R7.3-Q2)*, available whenever
   * the owner likes — including after the draft ends, which is all that is left
   * of post-draft editing under a hard position gate.
   */
  const swapIn = useCallback(
    (seat: number, player: Player) => {
      setBoard((previous) => {
        const squad: Squad = {}
        for (const pick of previous.picks) if (pick.seat === seat) squad[pick.slot] = pick.player

        const open = formation.find(
          (slot) => slot.position === player.position && !squad[slot.id],
        )
        const target = open ?? formation.find((slot) => slot.position === player.position)
        if (!target) return previous

        const occupant = squad[target.id] ?? null
        const picks = previous.picks.filter(
          (pick) => !(pick.seat === seat && pick.slot === target.id),
        )
        picks.push({ overall: picks.length, seat, slot: target.id, player })

        return {
          picks,
          spare: previous.spare.map((list, at) =>
            at === seat
              ? [...list.filter((entry) => entry.id !== player.id), ...(occupant ? [occupant] : [])]
              : list,
          ),
        }
      })
      setLastArrival(player.id)
    },
    [],
  )

  /* ------------------------------------------------------------- the block -- */

  /** The host's own application of a raise, whoever it came from. */
  const applyBid = useCallback((seat: number, step: number) => {
    setBlock((previous) => {
      if (!previous || previous.phase !== 'live') return previous
      if (previous.holder === seat || previous.out.includes(seat)) return previous

      const price = previous.holder === null ? previous.lot.opening : previous.price + step
      if (price > (live.current.budgets[seat] ?? 0)) return previous

      return {
        ...previous,
        price,
        holder: seat,
        bids: { ...previous.bids, [seat]: price },
        resets: previous.resets + 1,
      }
    })
  }, [])

  /**
   * A seat standing down. Final for this lot — see `lotIsDecided`, which is
   * what makes the hammer able to fall early rather than sitting out a
   * countdown nobody is going to interrupt.
   */
  const applyPass = useCallback((seat: number) => {
    setBlock((previous) => {
      if (!previous || previous.phase !== 'live') return previous
      if (previous.holder === seat || previous.out.includes(seat)) return previous
      return { ...previous, out: [...previous.out, seat] }
    })
  }, [])

  const placeBid = useCallback(
    (seat: number, step: number) => {
      if (isMultiplayer && !isHost && config.roomId) {
        placeAuctionBid(config.roomId, seat, step)
        return
      }
      applyBid(seat, step)
    },
    [isMultiplayer, isHost, config.roomId, applyBid],
  )

  const passLot = useCallback(
    (seat: number) => {
      if (isMultiplayer && !isHost && config.roomId) {
        placeAuctionPass(config.roomId, seat)
        return
      }
      applyPass(seat)
    },
    [isMultiplayer, isHost, config.roomId, applyPass],
  )

  /* The host drains the queue. Each entry is removed as it is handled, so a
     re-attached listener does not replay the whole auction — see
     `useActionQueue`. */
  useActionQueue(config.roomId, 'auctionBids', isMultiplayer && isHost, (payload) => {
    if (typeof payload.seat !== 'number') return
    if (payload.pass) applyPass(payload.seat)
    else applyBid(payload.seat, payload.step ?? 0)
  })

  /** Open whatever the cursor is pointing at, or stop the auction. */
  useEffect(() => {
    if (lots.length === 0 || finished) return
    if (block && block.lot.number === lots[cursor]?.number) return
    if (!isHost) return

    const lot = lots[cursor]
    if (!lot) {
      setFinished(true)
      return
    }

    if (auctionExhausted(lots.slice(cursor), live.current.budgets, live.current.squads)) {
      setFinished(true)
      return
    }

    setBlock({
      lot,
      price: lot.opening,
      holder: null,
      bids: {},
      out: [],
      phase: 'live',
      resets: 0,
    })
  }, [cursor, lots, finished, block, isHost])

  /* -------------------------------------------------------------- the clock -- */

  /** One lot, one round of bidding on it. Any bid mints a new one. */
  const clockKey = block ? block.lot.number * 1000 + block.resets : -1

  useEffect(() => {
    if (!block || block.phase !== 'live') return
    const key = block.lot.number * 1000 + block.resets
    setClock({ key, left: limit })

    const tick = window.setInterval(
      () =>
        setClock((current) =>
          current.key === key ? { key, left: Math.max(0, current.left - 1) } : current,
        ),
      1000,
    )
    return () => window.clearInterval(tick)
  }, [block?.lot.number, block?.resets, block?.phase, limit])

  /**
   * The lockout, on the same key as the countdown it belongs to: a new lot or
   * a new bid closes bidding for `LOCKOUT_MS` and then opens it again. Its own
   * timer rather than a read off `clock.left`, so it is exact rather than
   * rounded to whichever second the tick happened to land on.
   */
  useEffect(() => {
    if (!block || block.phase !== 'live') {
      setArmed(false)
      return
    }
    setArmed(false)
    const timer = window.setTimeout(() => setArmed(true), LOCKOUT_MS)
    return () => window.clearTimeout(timer)
  }, [block?.lot.number, block?.resets, block?.phase])

  /**
   * The lot closes: the clock ran out with no new bid, **or** everybody but
   * the holder has passed and there is nothing left for the clock to wait for
   * *(2026-08-23)*. Either way it goes to the highest bidder, or into the
   * unsold pile if nobody ever took the opening price *(R8-Q4)*.
   */
  const decided = Boolean(
    block && block.phase === 'live' && lotIsDecided(block.holder, block.out, seatCount),
  )

  useEffect(() => {
    if (!block || block.phase !== 'live') return
    if (!decided && (clock.key !== clockKey || clock.left > 0)) return
    if (!isHost) return

    const { holder, price, lot } = block

    setBlock((previous) =>
      previous && previous.phase === 'live'
        ? { ...previous, phase: holder !== null ? 'sold' : 'unsold' }
        : previous,
    )
    /* Guarded on the lot number rather than appended blindly. Two things can
       now close a lot — the clock reaching zero and the room finishing with it
       — and either can fire on a render where the phase change from the other
       has not landed yet. The phase update above is already idempotent; this
       makes the sale idempotent too, so a lot cannot be sold twice. */
    setSales((previous) =>
      previous.some((sale) => sale.lot === lot.number)
        ? previous
        : [
            ...previous,
            {
              lot: lot.number,
              player: lot.player,
              seat: holder,
              price: holder === null ? 0 : price,
            },
          ],
    )
  }, [clock, clockKey, block, decided, isHost, seatCount])

  /** The hammer holds, then the next lot comes up. */
  useEffect(() => {
    if (!block || block.phase === 'live') return
    if (!isHost) return
    const timer = window.setTimeout(() => setCursor((at) => at + 1), RESULT_HOLD)
    return () => window.clearTimeout(timer)
  }, [block?.lot.number, block?.phase, isHost])

  /**
   * The auction has run its course. Anybody left with empty slots has them
   * filled with the **lowest-rated** footballers still available, drawn from
   * the whole scoped pool rather than from the lot list — the `15 × N` cap and
   * its high-ability skew decide who goes on the block and have no business
   * deciding who fills a slot nobody bid for. Running out of money gets you
   * worse players, never fewer.
   */
  useEffect(() => {
    if (!finished) return
    setBlock(null)

    setBoard((previous) => {
      const taken = new Set<string>()
      for (const pick of previous.picks) taken.add(pick.player.id)
      for (const list of previous.spare) for (const player of list) taken.add(player.id)

      const picks = [...previous.picks]
      for (let seat = 0; seat < seatCount; seat += 1) {
        const squad: Squad = {}
        for (const pick of picks) if (pick.seat === seat) squad[pick.slot] = pick.player

        for (const slot of formation) {
          if (squad[slot.id]) continue
          const player = weakestFor(slot.position, scopedRef.current, taken)
          if (!player) continue
          taken.add(player.id)
          squad[slot.id] = player
          picks.push({ overall: picks.length, seat, slot: slot.id, player })
        }
      }

      return { ...previous, picks }
    })
  }, [finished, seatCount])

  /* ------------------------------------------------------------- bot bidding --- */
  const botBiddingLocks = useRef<Record<number, boolean>>({})
  
  useEffect(() => {
    if (!block || block.phase !== 'live' || !isHost) {
      botBiddingLocks.current = {}
      return
    }

    const runBotBid = async (seat: number) => {
      if (botBiddingLocks.current[seat]) return
      botBiddingLocks.current[seat] = true

      try {
        const { botDelay, evaluateDiscreteHead } = await import('../lib/bot/inference')
        const { encodeBiddingContext, BIDDING_OBS_LEN } = await import('../lib/bot/encoders')
        
        await botDelay()
        
        const currentBlock = live.current.block
        if (!currentBlock || currentBlock.phase !== 'live') return
        if (currentBlock.holder === seat || currentBlock.out.includes(seat)) return

        const budget = live.current.budgets[seat] ?? 0
        const isLockedOut = !live.current.armed

        // In footydraft_sim/env_auction.py:
        // 0: PASS, 1: WAIT, 2: RAISE5, 3: RAISE10, 4: RAISE25
        const legalActionMask = [
          true, // 0: PASS
          true, // 1: WAIT
          !isLockedOut && (currentBlock.holder === null ? currentBlock.lot.opening <= budget : (currentBlock.price + 5) <= budget), // 2: RAISE5
          !isLockedOut && (currentBlock.holder === null ? currentBlock.lot.opening <= budget : (currentBlock.price + 10) <= budget), // 3: RAISE10
          !isLockedOut && (currentBlock.holder === null ? currentBlock.lot.opening <= budget : (currentBlock.price + 25) <= budget), // 4: RAISE25
        ]
        
        const context = encodeBiddingContext(
          seat,
          live.current.squads,
          seatCount,
          cursor,
          lots.length,
          currentBlock.lot.player,
          currentBlock.lot.opening,
          currentBlock.price,
          currentBlock.holder,
          currentBlock.out.length,
          isLockedOut,
          live.current.budgets
        )
        
        const actionIdx = await evaluateDiscreteHead('auction_bid', context, BIDDING_OBS_LEN, legalActionMask)
        
        if (actionIdx === 0) {
          applyPass(seat)
        } else if (actionIdx === 1) {
          // WAIT: do nothing
        } else if (actionIdx === 2) {
          applyBid(seat, 5)
        } else if (actionIdx === 3) {
          applyBid(seat, 10)
        } else if (actionIdx === 4) {
          applyBid(seat, 25)
        }
      } catch (e) {
        console.error(e)
      } finally {
        botBiddingLocks.current[seat] = false
      }
    }

    drafters.forEach((d, seat) => {
      if (d.kind === 'bot' && !block.out.includes(seat) && block.holder !== seat) {
        runBotBid(seat)
      }
    })
  }, [block, clock.left, isHost, cursor, lots.length, seatCount, armed, applyBid, applyPass, drafters])

  /* ------------------------------------------------------------- bot swapping --- */
  const botSwapLocks = useRef<Record<number, boolean>>({})
  
  useEffect(() => {
    if (!finished || block || !isHost) return

    const runBotSwap = async (seat: number) => {
      if (botSwapLocks.current[seat]) return
      botSwapLocks.current[seat] = true

      try {
        const spare = board.spare[seat] || []
        if (spare.length === 0) return // Done

        const { evaluateCandidateScorer, botDelay } = await import('../lib/bot/inference')
        const { encodeContext, encodeCandidates, CONTEXT_LEN, CANDIDATE_FEATURE_LEN } = await import('../lib/bot/encoders')
        
        await botDelay()
        
        const context = encodeContext(seat, squads, seatCount, lots.length, lots.length, null)
        const candFeatures = encodeCandidates(spare, null, null)
        
        // Append all-zero vector for "PASS"
        const finalCandFeatures = new Float32Array(candFeatures.length + CANDIDATE_FEATURE_LEN)
        finalCandFeatures.set(candFeatures, 0) // zero-filled at the end automatically
        
        const actionIdx = await evaluateCandidateScorer(
          'auction_swap',
          context,
          CONTEXT_LEN,
          finalCandFeatures,
          CANDIDATE_FEATURE_LEN,
          spare.length + 1
        )
        
        if (actionIdx === spare.length) {
          // Passed, bot is happy with squad
          return
        }
        
        const chosen = spare[actionIdx]
        if (chosen) swapIn(seat, chosen)
        
      } catch (e) {
        console.error(e)
      } finally {
        // We unlock so the effect can re-run and evaluate the next swap, but we need
        // a small delay to avoid React render cycles locking up immediately.
        setTimeout(() => { botSwapLocks.current[seat] = false }, 100)
      }
    }

    drafters.forEach((d, seat) => {
      if (d.kind === 'bot' && (board.spare[seat] || []).length > 0) {
        runBotSwap(seat)
      }
    })
  }, [finished, block, isHost, board.spare, squads, seatCount, lots.length, swapIn, drafters])

  /* --------------------------------------------------------------- render --- */

  const you = drafters[youSeat]
  const yourSquad = squads[youSeat] ?? {}
  const shownSquad = squads[tab] ?? {}
  const shownFilled = formation.filter((slot) => shownSquad[slot.id]).length

  const result: BlockResult | null =
    block && block.phase !== 'live'
      ? {
          buyer: block.holder === null ? null : (drafters[block.holder]?.name ?? '—'),
          price: block.price,
          yours: block.holder === youSeat,
        }
      : null

  /* The pending slot is where the lot on the block would land on your own
     board, so the pitch previews the buy before the hammer does. Only while
     you actually hold it — a preview of somebody else's lot is a lie. */
  const pendingSlot =
    block && block.phase === 'live' && block.holder === youSeat
      ? (formation.find((slot) => slot.id === landingSlot(block.lot.player, yourSquad)) ?? null)
      : null

  const yourSpare = board.spare[youSeat] ?? []

  /* Nothing below this line is safe to draw without a seat — see `DraftGate`. */
  if (!seated || !you) return <DraftGate />

  /* Once the auction is done and the block has been cleared (backfill has run),
     swap to the comparison screen. */
  if (finished && !block) {
    return <SquadCompare drafters={drafters} squads={squads} />
  }

  return (
    <div
      className="draft auction flex h-full w-full flex-col px-[var(--app-inset-x)] py-[var(--app-inset-y)]"
      data-pane={pane}
    >
      {/* ---- The way out, the lot, and the table you are at.

              Where the other three screens put a narrator, this one puts the
              headline — the footballer on the block, who holds them and at
              what. It is the same job (one line, read from across the room,
              saying where the format currently stands) done without a
              sentence, which non-negotiable 7 rules out on this screen. ---- */}
      <div className="fx fx-soft flex shrink-0 flex-col items-stretch gap-[10px] border-b border-line-strong py-[12px] sm:flex-row sm:items-center sm:gap-5">
        <div className="flex shrink-0 items-center gap-3">
          <BackHome confirm confirmNote={t('The auction ends here. Nothing about it is saved.')} />
          <LanguageSwitch className="hidden sm:flex" />
        </div>

        <div className="flex min-w-0 flex-1 justify-center">
          {block ? (
            <Headline
              player={block.lot.player}
              holder={block.holder === null ? null : (drafters[block.holder]?.name ?? null)}
              yours={block.holder === youSeat}
              price={block.price}
            />
          ) : null}
        </div>

        <div className="flex shrink-0 items-center justify-end">
          <TableStrip drafters={drafters} active={block?.holder ?? -1} />
        </div>
      </div>

      <div className="auction-grid min-h-0 flex-1">
        {/* ---- What has gone, and the room talking about it. ---- */}
        <div
          className="auction-rail fx fx-soft flex-col gap-[20px] pr-[26px] pt-[20px]"
          style={{ animationDelay: '90ms' }}
        >
          <SoldRecord sales={sales} drafters={drafters} youSeat={youSeat} />
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

        {/* ---- The centre stack: count, displayer, countdown, bids, steps. ---- */}
        <div
          className="auction-centre fx fx-soft min-h-0 flex-col pt-[20px] min-[1180px]:border-l min-[1180px]:border-line min-[1180px]:pl-[26px] min-[1180px]:pr-[26px] md:pr-[26px]"
          style={{ animationDelay: '150ms' }}
        >
          {block ? (
            <>
              <AuctionBlock
                lot={block.lot}
                left={Math.max(0, lots.length - block.lot.number)}
                total={lots.length}
                result={result}
              />
              <BidBoard
                drafters={drafters}
                youSeat={youSeat}
                holder={block.holder}
                price={block.price}
                bids={block.bids}
                out={block.out}
                budgets={budgets}
                seconds={clock.key === clockKey ? clock.left : limit}
                limit={limit}
                resetKey={clockKey}
                live={block.phase === 'live'}
                armed={armed}
                onBid={(step) => placeBid(youSeat, step)}
                onPass={() => passLot(youSeat)}
              />
            </>
          ) : (
            <div className="grid min-h-0 flex-1 place-items-center rounded-lg border border-line-strong bg-surface">
              <span className="font-display text-[11px] font-medium uppercase tracking-[0.2em] text-dim">
                {poolError ?? (finished ? t('Closed') : t('Opening'))}
              </span>
            </div>
          )}
        </div>

        {/* ---- The elevens, every one of them, the whole way through. ---- */}
        <div
          className="auction-board fx fx-soft min-h-0 flex-col pt-[20px] md:border-l md:border-line md:pl-[26px]"
          style={{ animationDelay: '210ms' }}
        >
          <div className="flex min-h-0 flex-1 flex-col">
            <PitchView
              drafters={drafters}
              tab={tab}
              onTab={setTab}
              squad={shownSquad}
              pending={tab === youSeat ? pendingSlot : null}
              preview={tab === youSeat && block && block.holder === youSeat ? block.lot.player : null}
              lastArrival={lastArrival}
            />
          </div>

          <div className="mt-[12px] flex shrink-0 items-baseline justify-between gap-4 border-t border-line pt-[10px]">
            <SectionLabel>{t('Filled')}{' '}
              <span className="tabular text-[11px] text-accent">{shownFilled}</span>{' '}
              <span className="text-faint">/ {SQUAD_SIZE}</span>
            </SectionLabel>
            <SectionLabel>
              {t('Left')}{' '}
              <span className="money tabular text-[11px] font-semibold text-ink">
                {budgets[tab] ?? 0}
              </span>
            </SectionLabel>
          </div>

          {/* Only ever your own, and only once there is one — a spare is a
              private thing *(R5-Q8)*, and an empty panel for a state most
              drafts never reach is furniture. */}
          {tab === youSeat && yourSpare.length > 0 ? (
            <div className="fx fx-soft mt-[10px] flex shrink-0 flex-col gap-[8px] border-t border-line pt-[10px]">
              <SectionLabel>{t('Unplaced')}</SectionLabel>
              <ul className="flex flex-wrap items-center gap-[8px]">
                {yourSpare.map((player) => (
                  <li key={player.id}>
                    <button
                      type="button"
                      onClick={() => swapIn(youSeat, player)}
                      title={player.name}
                      className="grid h-[34px] w-[34px] place-items-center overflow-hidden rounded-full border border-line-strong bg-surface-2 transition-colors duration-150 ease-out hover:border-accent"
                    >
                      <SpareFace player={player} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      {/* ---- One viewport, one column: the two halves take turns. ---- */}
      <div className="mt-[12px] flex shrink-0 items-center gap-[2px] border-t border-line pt-[10px] md:hidden">
        <PaneTab active={pane === 'block'} onClick={() => setPane('block')}>{t('The block')}</PaneTab>
        <PaneTab active={pane === 'board'} onClick={() => setPane('board')}>{t('The elevens')}</PaneTab>
      </div>
    </div>
  )
}

/**
 * The lot, in one line, at the top of the screen: who is up, who holds them
 * and at what. Three facts and two dots — no verb, no sentence, per the
 * exhibition's non-negotiable 7.
 */
function Headline({
  player,
  holder,
  yours,
  price,
}: {
  player: Player
  holder: string | null
  yours: boolean
  price: number
}) {
  const { t } = useI18n();

  return (
    <p
      aria-live="polite"
      className="auction-head flex min-w-0 items-baseline justify-center gap-[10px] truncate font-display font-bold uppercase leading-none tracking-[0.02em]"
    >
      <span key={player.id} className="fx fx-soft truncate text-ink">
        {player.surname}
      </span>

      <Dot />

      {holder === null ? (
        <>
          <span className="shrink-0 text-[0.52em] font-medium tracking-[0.2em] text-dim">{t('Opening')}</span>
          <Dot />
          <span className="money tabular shrink-0 text-muted">{price}</span>
        </>
      ) : (
        <>
          <span className="hidden shrink-0 text-[0.52em] font-medium tracking-[0.2em] text-dim lg:inline">{t('Highest bidder:')}</span>
          <span className="max-w-[8ch] shrink truncate text-ink">{holder}</span>
          <Dot />
          <span
            key={price}
            className={`money tabular fx fx-soft shrink-0 ${yours ? 'text-accent' : 'text-ink'}`}
          >
            {price}
          </span>
        </>
      )}
    </p>
  )
}

function Dot() {

  return (
    <span aria-hidden="true" className="shrink-0 self-center text-[0.4em] text-accent">
      ●
    </span>
  )
}

function SpareFace({ player }: { player: Player }) {

  const [failed, setFailed] = useState(false)

  if (failed) {
    return <Crest className="h-[62%] w-[62%]" src={player.crest} alt={player.club} />
  }

  return (
    <Dotgrid player={player} frame="spare-face" className="h-full w-full" onError={() => setFailed(true)} />
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
