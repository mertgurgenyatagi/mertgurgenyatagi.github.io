import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AuctionBlock, type BlockResult } from '../components/draft/AuctionBlock'
import { BidBoard } from '../components/draft/BidBoard'
import { DraftChat } from '../components/draft/DraftChat'
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
  type Lot,
  type Sale,
  auctionExhausted,
  buildLotList,
  cheapestFor,
  landingSlot,
  startingBudget,
} from '../lib/auctionEngine'
import { evaluateAuctionBot } from '../lib/auctionBot'
import { useMultiplayerRoom, useHostBotTakeover, updateAuctionState, placeAuctionBid, sendChatMessage } from '../lib/multiplayer'
import { ref, onChildAdded } from 'firebase/database'
import { database } from '../lib/firebase'
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
  { id: 'bot-1', name: 'Bot 1', kind: 'bot', mark: '1' },
  { id: 'bot-2', name: 'Bot 2', kind: 'bot', mark: '2' },
]

/**
 * The countdown is this format's own closing mechanism rather than a courtesy
 * to a slow drafter — with no turns, it is the only thing that ends a lot. So
 * a lobby that switched timers off still gets one here, at the default length.
 */
const FALLBACK_TIMER = 15

/** How long the hammer holds on screen before the next lot comes up. */
const RESULT_HOLD = 1900

/** How often the room considers raising. Bids land on some of these, not all. */
const BID_TICK = 480

/**
 * **Nobody may bid for the first three seconds of a countdown** — and the
 * countdown restarts on every bid, so this is a cooling-off period after each
 * raise rather than a one-off at the top of a lot.
 *
 * It applies to the room exactly as it applies to you: the simulated seats
 * read the same flag, so a lot cannot be walked up by two bots trading raises
 * faster than anybody can read them. What it buys is a beat to look at the
 * footballer and at what they are being held at before deciding, which is the
 * only decision this format has.
 */
const LOCKOUT_MS = 3000

const CHATTER = [
  'too rich for me',
  'go on then',
  'not selling',
  'he is worth double',
  'let it go',
  'keep going',
  'that is a steal',
  'i needed that one',
]

type Phase = 'live' | 'sold' | 'unsold'

export interface Block {
  lot: Lot
  /** The opening price until somebody takes it, then whatever it is held at. */
  price: number
  holder: number | null
  bids: Record<number, number>
  /** Seats that have passed on this lot. */
  out: number[]
  phase: Phase
  /** Bumped by every bid, which is what sends the countdown back to full. */
  resets: number
}

/**
 * The Auction, drawn as layout 01 of the exhibition — "The block".
 *
 * The lot is the page. One unbroken centre column runs the count, the
 * footballer, the countdown and the five drafters bidding side by side, with
 * what has already gone down the left and the elevens on the right.
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
 * the holder readout carries the present tense. Nothing on this screen is a
 * sentence.
 */
export function AuctionDraft({ config }: { config: DraftConfig }) {
  const { t } = useI18n();

  const scope = config.scope ?? 'top-5'
  const league = config.league ?? 'premier-league'
  const timerSetting = config.timer ?? '15'
  const limit = timerSetting === 'off' ? FALLBACK_TIMER : Number(timerSetting) || FALLBACK_TIMER

  const { room, uid } = useMultiplayerRoom(config.roomId)
  const isMultiplayer = Boolean(config.roomId)
  const isHost = isMultiplayer ? room?.host === uid : true
  useHostBotTakeover(config.roomId, isHost, room)

  const baseDrafters = config.drafters?.length ? config.drafters : DEFAULT_DRAFTERS
    const drafters = useMemo(() => {
      if (!isMultiplayer || !room?.drafters) return baseDrafters
      
      const computedSeats: Drafter[] = []
      const drafterEntries = Object.entries(room.drafters)
      const hostEntry = drafterEntries.find(([id]) => id === room.host)
      if (hostEntry) {
        computedSeats.push({
          id: hostEntry[0],
          kind: hostEntry[0] === uid ? 'you' : hostEntry[1].kind as any,
          name: hostEntry[1].name,
          mark: hostEntry[1].mark,
        })
      }
      
      const humanEntries = drafterEntries.filter(([id, d]) => id !== room.host && d.kind !== 'bot').sort(([a], [b]) => a.localeCompare(b))
      for (const [id, drafter] of humanEntries) {
        computedSeats.push({
          id,
          kind: id === uid ? 'you' : drafter.kind as any,
          name: drafter.name,
          mark: drafter.mark,
        })
      }
      
      const botEntries = drafterEntries.filter(([, d]) => d.kind === 'bot').sort(([a], [b]) => a.localeCompare(b))
      for (const [id, drafter] of botEntries) {
        computedSeats.push({
          id,
          kind: 'bot',
          name: drafter.name,
          mark: drafter.mark,
        })
      }
      return computedSeats
    }, [baseDrafters, isMultiplayer, room?.drafters, room?.host, uid])

  const seatCount = drafters.length
  const youSeat = Math.max(
    0,
    drafters.findIndex((drafter) => drafter.kind === 'you'),
  )

  const [pool, setPool] = useState<Player[]>([])
  const [poolError, setPoolError] = useState<string | null>(null)
  const [lots, setLots] = useState<Lot[]>([])
  const [cursor, setCursor] = useState(0)
  const [block, setBlock] = useState<Block | null>(null)
  const [sales, setSales] = useState<Sale[]>([])
  const [finished, setFinished] = useState(false)

  // Sync state from host to clients
  useEffect(() => {
    if (isMultiplayer && !isHost) {
      if (room?.auctionBlock !== undefined) {
        const b = room.auctionBlock
        setBlock(b ? { ...b, bids: b.bids || {}, out: b.out || [] } : null)
      }
      if (room?.auctionSales !== undefined) {
        setSales(room.auctionSales || [])
      }
    }
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
  const [tab, setTab] = useState(youSeat)
  const [pane, setPane] = useState<'block' | 'board'>('block')
  const [localMessages, setMessages] = useState<Message[]>([])
  const messages = isMultiplayer && room?.chat ? Object.values(room.chat).sort((a, b) => a.id - b.id) : localMessages
  const [lastArrival, setLastArrival] = useState<string | null>(null)

  /* Purchases, and the spares that had nowhere to go. A buy lands straight in
     an open slot; only when every slot for that position is full does it
     overflow *(R7.2-Q1)*. */
  const [board, setBoard] = useState<{ picks: Pick[]; spare: Player[][] }>(() => ({
    picks: [],
    spare: drafters.map(() => []),
  }))

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
  const scopedRef = useRef(scoped)
  scopedRef.current = scoped

  const startBudget = useMemo(() => startingBudget(scoped), [scoped])

  useEffect(() => {
    const handleError = (e: ErrorEvent) => {
      console.error("AUCTION DRAFT CRASHED:", e.error);
    }
    window.addEventListener('error', handleError)
    return () => window.removeEventListener('error', handleError)
  }, [])
  
  useEffect(() => {
    if (scoped.length === 0 || lots.length > 0) return
    setLots(buildLotList(scoped, seatCount))
  }, [scoped, seatCount, lots.length])

  /* --------------------------------------------------------- what is owned -- */

  const squads = useMemo(() => {
    const built: Squad[] = drafters.map(() => ({}))
    for (const pick of board.picks) built[pick.seat][pick.slot] = pick.player
    return built
  }, [board.picks, drafters])

  const budgets = useMemo(() => {
    const left = drafters.map(() => startBudget)
    for (const sale of sales) if (sale.seat !== null) left[sale.seat] -= sale.price
    return left
  }, [sales, drafters, startBudget])

  /** The bidding loop reads these several times a second; state would go stale. */
  const live = useRef({ squads, budgets, block, armed, sales })
  live.current = { squads, budgets, block, armed, sales }

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

      return {
        ...previous,
        spare: previous.spare.map((list, at) => (at === seat ? [...list, player] : list)),
      }
    })
    setLastArrival(player.id)
  }, [])

  /**
   * The graveyard swap: a spare goes into its slot and whoever was holding it
   * comes back out. A straight two-way exchange *(R7.3-Q2)*, available whenever
   * the owner likes — including after the draft ends, which is all that is left
   * of post-draft editing under a hard position gate.
   */
  const swapIn = useCallback(
    (player: Player) => {
      setBoard((previous) => {
        const squad: Squad = {}
        for (const pick of previous.picks) if (pick.seat === youSeat) squad[pick.slot] = pick.player

        const open = formation.find(
          (slot) => slot.position === player.position && !squad[slot.id],
        )
        const target = open ?? formation.find((slot) => slot.position === player.position)
        if (!target) return previous

        const occupant = squad[target.id] ?? null
        const picks = previous.picks.filter(
          (pick) => !(pick.seat === youSeat && pick.slot === target.id),
        )
        picks.push({ overall: picks.length, seat: youSeat, slot: target.id, player })

        return {
          picks,
          spare: previous.spare.map((list, at) =>
            at === youSeat
              ? [...list.filter((entry) => entry.id !== player.id), ...(occupant ? [occupant] : [])]
              : list,
          ),
        }
      })
      setLastArrival(player.id)
    },
    [youSeat],
  )

  /* ------------------------------------------------------------- the block -- */

  const placeBid = useCallback((seat: number, step: number) => {
    if (isMultiplayer && !isHost && config.roomId) {
      placeAuctionBid(config.roomId, seat, step)
      return
    }
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
  }, [isMultiplayer, isHost, config.roomId])

  useEffect(() => {
    if (!isMultiplayer || !isHost || !config.roomId) return
    const bidsRef = ref(database, `rooms/${config.roomId}/auctionBids`)
    return onChildAdded(bidsRef, (snapshot) => {
      const bid = snapshot.val()
      placeBid(bid.seat, bid.step)
    })
  }, [isMultiplayer, isHost, config.roomId, placeBid])

  /** Open whatever the cursor is pointing at, or stop the auction. */
  useEffect(() => {
    if (lots.length === 0 || finished) return
    if (block && block.lot.number === lots[cursor]?.number) return

    const lot = lots[cursor]
    if (!lot) {
      setFinished(true)
      return
    }

    if (auctionExhausted(lots.slice(cursor), live.current.budgets, live.current.squads)) {
      setFinished(true)
      return
    }

    if (!isHost) return

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

  /* ------- The room, bidding. Everyone but you is simulated, in real time. --- */

  useEffect(() => {
    if (!block || block.phase !== 'live') return
    if (!isHost) return

    const tick = window.setInterval(() => {
      const now = live.current.block
      if (!now || now.phase !== 'live') return
      // The lockout is the room's too — see LOCKOUT_MS. Held before the
      // valuations are read at all, so a locked tick costs nothing.
      if (!live.current.armed) return

      const willing: { seat: number; step: number }[] = []
      const spent: number[] = []

      const POS_LIST = ['AMF', 'CB', 'CDM', 'CM', 'GK', 'LB', 'LW', 'RB', 'RW', 'ST']
      const lotsRevealed = new Array(10).fill(0)
      const lotsSold = new Array(10).fill(0)
      
      for (const sale of live.current.sales) {
        const pIdx = POS_LIST.indexOf(sale.player.position)
        if (pIdx >= 0) {
          lotsRevealed[pIdx]++
          if (sale.seat !== null) lotsSold[pIdx]++
        }
      }
      const currentPIdx = POS_LIST.indexOf(now.lot.player.position)
      if (currentPIdx >= 0) lotsRevealed[currentPIdx]++
      
      const lotsRemaining = Math.max(0, (15 * seatCount) - now.lot.number)
      const fractionElapsed = Math.min(1.0, now.lot.number / Math.max(1, 15 * seatCount))
      const scopedPoolSize = scopedRef.current.length

      for (let seat = 0; seat < seatCount; seat += 1) {
        if (seat === youSeat || seat === now.holder || now.out.includes(seat)) continue

        const drafter = drafters[seat]
        if (drafter.kind !== 'bot') continue

        const step = evaluateAuctionBot(
          seat,
          now,
          live.current.squads,
          live.current.budgets,
          seatCount,
          lotsRevealed,
          lotsSold,
          lotsRemaining,
          fractionElapsed,
          scopedPoolSize
        )

        if (step !== null) willing.push({ seat, step })
        else spent.push(seat)
      }

      /* A seat whose line the price has already crossed is out of this lot for
         good — its valuation is fixed for the lot's length and its budget only
         ever falls, so it can never come back in. Saying so is what draws the
         four dimmed cards next to the one holding it. */
      if (spent.length > 0) {
        setBlock((previous) =>
          previous && previous.phase === 'live'
            ? {
                ...previous,
                out: [...previous.out, ...spent.filter((seat) => !previous.out.includes(seat))],
              }
            : previous,
        )
      }

      if (willing.length === 0) return
      // A raise is a decision, not a reflex: at most one per tick, and not
      // every tick, so the clock actually gets to run down between them.
      if (Math.random() > 0.52) return

      const raise = willing[Math.floor(Math.random() * willing.length)]
      placeBid(raise.seat, raise.step)
    }, BID_TICK)

    return () => window.clearInterval(tick)
  }, [block?.lot.number, block?.phase, seatCount, youSeat, placeBid, isHost])

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
   * The clock ran out with no new bid, so the lot closes: to the highest
   * bidder, or into the unsold pile if nobody ever took the opening price
   * *(R8-Q4)*.
   */
  useEffect(() => {
    if (!block || block.phase !== 'live') return
    if (clock.key !== clockKey || clock.left > 0) return
    if (!isHost) return

    const { holder, price, lot } = block

    setBlock((previous) =>
      previous && previous.phase === 'live'
        ? { ...previous, phase: holder !== null ? 'sold' : 'unsold' }
        : previous,
    )
    setSales((previous) => [
      ...previous,
      { lot: lot.number, player: lot.player, seat: holder, price: holder === null ? 0 : price },
    ])
    if (holder !== null) {
      award(holder, lot.player)
      if (isMultiplayer && isHost && config.roomId) {
        const winner = drafters[holder].name
        sendChatMessage(config.roomId, '', `Lot ${lot.number} - ${lot.player.name} - €${price}M to ${winner}`)
      } else if (!isMultiplayer && holder === youSeat) {
        setMessages((current) => [
          ...current,
          {
            id: messageId.current++,
            kind: 'system',
            author: '',
            body: `Lot ${lot.number} - ${lot.player.name} - €${price}M`,
          },
        ])
      }
    }
    }, [clock, clockKey, block, award, youSeat, isHost, isMultiplayer, config.roomId, drafters])

  /** The hammer holds, then the next lot comes up. */
  useEffect(() => {
    if (!block || block.phase === 'live') return
    const timer = window.setTimeout(() => setCursor((at) => at + 1), RESULT_HOLD)
    return () => window.clearTimeout(timer)
  }, [block?.lot.number, block?.phase])

  /**
   * The auction has run its course. Anybody left with empty slots has them
   * filled with the cheapest still-eligible footballers — running out of money
   * gets you worse players, never fewer. Backfill draws first from what the lot
   * cap kept off the block and only then from the unsold pile, which is what
   * taking it from the scoped pool minus everything sold amounts to.
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
          const player = cheapestFor(slot.position, scopedRef.current, taken)
          if (!player) continue
          taken.add(player.id)
          squad[slot.id] = player
          picks.push({ overall: picks.length, seat, slot: slot.id, player })
        }
      }

      return { ...previous, picks }
    })
  }, [finished, seatCount])

  /* ------------------------------------------------------------- the room --- */

  const spoke = useRef(-1)
  useEffect(() => {
    if (!block || block.holder === null || block.holder === youSeat) return
    if (spoke.current === block.resets) return
    spoke.current = block.resets
    if (Math.random() > 0.16) return

    const speaker = drafters[(block.holder + 1) % seatCount]
    const timer = window.setTimeout(() => {
      const text = CHATTER[Math.floor(Math.random() * CHATTER.length)]
      if (isMultiplayer && isHost && config.roomId) {
        sendChatMessage(config.roomId, speaker.name, text)
      } else if (!isMultiplayer) {
        setMessages((current) => [
          ...current,
          {
            id: messageId.current++,
            kind: 'said',
            author: speaker.name,
            body: text,
          },
        ])
      }
    }, 700)

    return () => window.clearTimeout(timer)
  }, [block?.resets, block?.holder, drafters, seatCount, youSeat, block])

  /* --------------------------------------------------------------- render --- */

const you = drafters[youSeat]
  const yourSquad = squads[youSeat] ?? {}
  const shownSquad = squads[tab] ?? {}
  const shownFilled = formation.filter((slot) => shownSquad[slot.id]).length

  const result: BlockResult | null =
    block && block.phase !== 'live'
      ? {
          buyer: block.holder === null ? null : drafters[block.holder]?.name ?? `Seat ${block.holder}`,
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

  console.log("AUCTION_DRAFT_RENDER", {
    isMultiplayer,
    isHost,
    roomId: config.roomId,
    roomBlock: room?.auctionBlock,
    roomSales: room?.auctionSales,
    baseDrafters,
    drafters,
    youSeat,
    lotsLength: lots.length,
    cursor,
    block,
    sales,
    squads,
    budgets,
  })

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
          <BackHome confirm confirmNote="The auction ends here. Nothing about it is saved." />
          <LanguageSwitch className="hidden sm:flex" />
        </div>

        <div className="flex min-w-0 flex-1 justify-center">
          {block ? (
            <Headline
              player={block.lot.player}
              holder={block.holder === null ? null : drafters[block.holder]?.name ?? `Seat ${block.holder}`}
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
              />
            </>
          ) : (
            <div className="grid min-h-0 flex-1 place-items-center rounded-lg border border-line-strong bg-surface">
              <span className="font-display text-[11px] font-medium uppercase tracking-[0.2em] text-dim">
                {poolError ?? (finished ? 'Closed' : 'Opening')}
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
              preview={tab === youSeat && block ? block.lot.player : null}
              lastArrival={lastArrival}
            />
          </div>

          <div className="mt-[12px] flex shrink-0 items-baseline justify-between gap-4 border-t border-line pt-[10px]">
            <SectionLabel>{t("Filled")}<span className="tabular text-[11px] text-accent">{shownFilled}</span>{' '}
              <span className="text-faint">/ {SQUAD_SIZE}</span>
            </SectionLabel>
            <SectionLabel>
              Left{' '}
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
              <SectionLabel>{t("Unplaced")}</SectionLabel>
              <ul className="flex flex-wrap items-center gap-[8px]">
                {yourSpare.map((player) => (
                  <li key={player.id}>
                    <button
                      type="button"
                      onClick={() => swapIn(player)}
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
        <PaneTab active={pane === 'block'} onClick={() => setPane('block')}>{t("The block")}</PaneTab>
        <PaneTab active={pane === 'board'} onClick={() => setPane('board')}>{t("The elevens")}</PaneTab>
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
          <span className="shrink-0 text-[0.52em] font-medium tracking-[0.2em] text-dim">{t("Opening")}</span>
          <Dot />
          <span className="money tabular shrink-0 text-muted">{price}</span>
        </>
      ) : (
        <>
          <span className="hidden shrink-0 text-[0.52em] font-medium tracking-[0.2em] text-dim lg:inline">{t("Highest bidder:")}</span>
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
