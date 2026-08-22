import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LanguageSwitch } from '../ui/LanguageSwitch'
import { StatusLine } from '../ui/StatusLine'
import { useI18n } from '../../lib/i18n'

interface LobbyLayoutProps {
  /** Accessible ID for the left column heading */
  leftHeadingId: string
  /** Seat count display, e.g. "4 / 5 seats" */
  seatCountLabel: string
  /** Key to re-trigger seat count animation when changed */
  seatCountKey?: number | string
  /** Content rendered above the seat list (e.g. <h1>{t("Your table")}</h1>{t("or")}<RoomCode />) */
  leftHeaderContent: ReactNode
  /** The SeatList component */
  seatList: ReactNode
  /** Bottom content for the left pane — the live chat, in both lobbies. */
  leftFooterContent?: ReactNode

  /** Chip groups / settings content */
  settingsContent: ReactNode
  /** Message displayed in the polite status line */
  statusMessage: string
  /** Key to trigger status line transition */
  statusKey?: number | string
  /**
   * The way out, drawn top left as a real button — `Back to home` in the solo
   * lobby, `Leave lobby` in the friends one. It used to sit in the footer as a
   * line of quiet label text next to the primary action, which put the only
   * exit from the screen in the least likely place to look for it.
   */
  backControl: ReactNode
  /** Primary action button (e.g. Kick off / Waiting for host) */
  actionControl: ReactNode
}

/**
 * Shared Split Studio diptych layout for solo and multiplayer lobbies.
 * Left half: who is playing (on a surface step, behind a hairline)
 * Right half: the configuration (on the ground)
 *
 * The two halves now open the same way — a small row of chrome, then a display
 * heading — so `YOUR TABLE` and `CONFIGURATION` sit on the same line across the
 * divide and read as one screen rather than as a panel beside a page.
 */
export function LobbyLayout({
  leftHeadingId,
  seatCountLabel,
  seatCountKey,
  leftHeaderContent,
  seatList,
  leftFooterContent,
  settingsContent,
  statusMessage,
  statusKey,
  backControl,
  actionControl,
}: LobbyLayoutProps) {
  const { t } = useI18n();

  return (
    <div className="lobby relative flex h-full flex-col overflow-hidden md:flex-row">
      {/* ══ Left Canvas: Who is playing ══ */}
      <section
        aria-labelledby={leftHeadingId}
        /* The surface step between the two halves is deliberately small — the
           palette's panels sit barely above the ground and take their edge
           from a hairline rather than from a fill. At full-height diptych
           scale that step alone stops reading as a division, so the border is
           what actually draws it. */
        className="fx fx-fade flex min-h-0 shrink-0 flex-col border-line bg-surface px-[var(--app-inset-x)] py-[var(--app-inset-y)] md:h-full md:w-1/2 md:border-r"
      >
        {/* Top left is the way out, on every screen in the app but home. */}
        <div
          className="fx fx-soft flex items-center justify-between gap-4"
          style={{ animationDelay: '80ms' }}
        >
          {backControl}
          <span
            key={seatCountKey ?? seatCountLabel}
            className="tabular fx fx-fade shrink-0 font-display text-[11px] font-medium uppercase tracking-[0.1em] text-dim"
          >
            {seatCountLabel}
          </span>
        </div>

        {leftHeaderContent}

        {seatList}

        {leftFooterContent}
      </section>

      {/* ══ Right Canvas: the configuration ══ */}
      <section
        aria-label={t("Draft settings")}
        className="relative flex min-h-0 flex-1 flex-col px-[var(--app-inset-x)] py-[var(--app-inset-y)] md:h-full md:w-1/2 md:flex-none"
      >
        <div
          className="fx fx-soft relative z-10 flex items-center justify-between gap-4"
          style={{ animationDelay: '120ms' }}
        >
          <LanguageSwitch />
          <Link
            to="/"
            aria-label="#footydraft — back to the home page"
            className="shrink-0 font-wordmark text-[19px] uppercase leading-none tracking-[0.06em] text-ink transition-opacity duration-150 ease-out hover:opacity-70"
          >
            <span className="text-accent">#</span>{t("footydraft")}</Link>
        </div>

        {/* Set at the same weight and on the same line as `Your table` opposite:
            this half is not a sidebar of settings, it is the other half of the
            screen and says so. */}
        <h2 className="fx fx-soft relative z-10 mt-[clamp(0.4rem,1.6vh,1rem)] hidden font-display text-[clamp(1.6rem,3.4vw,2.75rem)] font-bold uppercase leading-[0.95] tracking-[0.02em] md:block"
          style={{ animationDelay: '160ms' }}
        >{t("Configuration")}</h2>

        {/* Settings chip groups container */}
        <div className="relative z-10 mt-[var(--lobby-gap)] flex flex-col">
          {settingsContent}
        </div>

        <div className="hidden flex-1 md:block" />

        {/* Footer: the status line, and the one action that leaves this screen
            forward. The way back lives top left now. */}
        <div className="relative z-10 mt-[var(--lobby-gap)]">
          <StatusLine message={statusMessage} statusKey={statusKey} />

          <div
            className="fx fx-soft mt-[clamp(0.35rem,1.2vh,0.75rem)] flex items-center justify-end gap-4"
            style={{ animationDelay: '600ms' }}
          >
            {actionControl}
          </div>
        </div>
      </section>
    </div>
  )
}
