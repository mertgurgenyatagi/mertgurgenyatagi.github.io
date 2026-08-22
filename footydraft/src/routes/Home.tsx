import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ActionBar } from '../components/home/ActionBar'
import { FormatWall } from '../components/home/FormatWall'
import { MessageRow } from '../components/home/MessageRow'
import { Wordmark } from '../components/home/Wordmark'
import { NameGate } from '../components/lobby/NameGate'
import { LanguageSwitch } from '../components/ui/LanguageSwitch'
import { makeRoomCode, normaliseRoomCode } from '../lib/roomCode'
import { useI18n } from '../lib/i18n'

/**
 * The front door. One viewport, no scroll: a wall of type with the stadium
 * clipped into it, the four single-player formats under it, and the lobby
 * controls along the bottom.
 *
 * Every control on the page goes somewhere now. A format tile opens the
 * single-player lobby on that format; creating a lobby mints a code and
 * joining one takes the code typed into the bar. Both stop at the same gate —
 * a friends lobby needs a name on the seat — and then open the room.
 *
 * **The whole stack is top-weighted.** The wordmark used to centre itself in
 * whatever the formats and the lobby bar left over, which at a desktop height
 * put well over a hundred pixels of nothing between it and `Single player`
 * while the bar hugged the bottom edge. The blocks are stacked tight under the
 * wordmark instead and the slack is given to the bottom, where the stadium is
 * already doing the work.
 */
export function Home() {
  const { t } = useI18n();

  const navigate = useNavigate()

  /** Which room the gate is about to open, and whether we're opening it. */
  const [gate, setGate] = useState<{ mode: 'create' | 'join'; code: string } | null>(null)

  return (
    <div className="relative flex h-full flex-col overflow-hidden px-[var(--app-inset-x)] py-[var(--app-inset-y)]">

      <header
        className="fx fx-rise relative z-10 flex items-center justify-between gap-6"
        style={{ animationDelay: '80ms' }}
      >
        <p className="font-display text-[10px] font-medium uppercase tracking-[0.2em] text-muted">{t("A drafting game for people who argue about squads")}</p>
        <LanguageSwitch />
      </header>

      {/* Above the bottom block on purpose: the hover shadow down there spreads
          wide enough to reach the tiles, and it has to pass behind them. */}
      <main className="relative z-20 flex shrink-0 flex-col">
        <div className="flex w-full items-start justify-between gap-8 pb-[clamp(0.6rem,2.6cqh,1.75rem)] pt-[clamp(0.35rem,2.2cqh,1.5rem)]">
          <Wordmark />

          <div
            className="fx fx-rise hidden max-w-[19rem] flex-col gap-2 pt-[clamp(0.25rem,1vh,0.75rem)] sm:flex"
            style={{ animationDelay: '260ms' }}
          >
            <p className="font-display text-[11px] font-medium uppercase tracking-[0.22em] text-accent">{t("Draft. Argue. Repeat.")}</p>
            <p className="font-sans text-sm leading-relaxed text-muted">
              {t("Build a 4-2-3-1 out of real footballers, four different ways — auction, snake draft, deal-or-no-deal, spin the wheel. Then hold it up next to your mates' squads. No stats, no leaderboard, just bragging rights.")}
            </p>
          </div>
        </div>

        {/* The tile picks the format; the lobby opens on it. */}
        <FormatWall onPick={(id) => navigate(`/solo/${id}`)} />
      </main>

      <div className="relative z-10 shrink-0">
        <MessageRow />

        <ActionBar
          onCreate={() => setGate({ mode: 'create', code: makeRoomCode() })}
          onJoin={(code) => setGate({ mode: 'join', code: normaliseRoomCode(code) })}
        />
      </div>

      {/* Where the slack goes now that nothing is pinned to the bottom edge. */}
      <div className="min-h-0 flex-1" />

      {gate ? (
        <NameGate
          mode={gate.mode}
          code={gate.code}
          onCancel={() => setGate(null)}
          onSubmit={(name) =>
            navigate(`/lobby/${gate.code}`, {
              state: { name, host: gate.mode === 'create' },
            })
          }
        />
      ) : null}
    </div>
  )
}
