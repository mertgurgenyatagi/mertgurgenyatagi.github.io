import type { Drafter } from '../../lib/draftEngine'
import { SectionLabel } from '../ui/SectionLabel'
import { useI18n } from '../../lib/i18n'

interface TurnIndicatorProps {
  drafters: Drafter[]
  /** Whose turn it is. Carried by the accent on the disc, not by a word. */
  active: number
  /** Which way the snake is running this round, for the connectors. */
  reversed: boolean
  /** Changes once per pick and never within one. Re-runs the seat transition. */
  turn: number
  yourTurn: boolean
}

/**
 * Who is at the table and whose turn it is.
 *
 * The seats are the same connected discs the Free Pick screen puts in its top
 * bar, given room to be read at a glance — the connectors carry the snake's
 * direction, which is the one thing about a draft order that is not obvious
 * from looking at it.
 *
 * There is no clock on it any more. The bid timer belongs to the Auction and
 * only to the Auction — a spin's turn ends when somebody picks — so the
 * seconds readout and the hairline that used to drain along the bottom edge
 * are both gone.
 */
export function TurnIndicator({
  drafters,
  active,
  reversed,
  turn,
  yourTurn,
}: TurnIndicatorProps) {
  const { t } = useI18n();

  return (
    <section
      key={turn}
      className="spin-panel relative flex min-h-0 flex-1 flex-col overflow-hidden p-[14px]"
    >
      <div className="flex shrink-0 items-baseline justify-between gap-3">
        <SectionLabel>{t("Table")}</SectionLabel>
        <span
          className={[
            'truncate font-display text-[10.5px] font-medium uppercase tracking-[0.14em]',
            yourTurn ? 'text-accent' : 'text-dim',
          ].join(' ')}
        >
          {yourTurn ? t('Your pick') : reversed ? t('Order reversed') : t('Order as drawn')}
        </span>
      </div>

      <ul className="mt-auto flex shrink-0 items-start justify-center pt-[12px]">
        {drafters.map((drafter, index) => (
          <li key={drafter.id} className="flex items-start">
            {index > 0 ? (
              <span
                aria-hidden="true"
                className="mt-[calc(var(--spin-seat)/2)] block h-px w-[clamp(10px,1.6vw,26px)] shrink-0 bg-line-strong"
              />
            ) : null}

            <div className="flex w-[calc(var(--spin-seat)+22px)] flex-col items-center gap-[7px]">
              <span
                className={[
                  'grid h-[var(--spin-seat)] w-[var(--spin-seat)] place-items-center rounded-full font-display text-[13px] font-medium transition-colors duration-300 ease-out',
                  index === active
                    ? 'bg-accent text-accent-ink'
                    : drafter.kind === 'bot'
                      ? 'border border-line-strong text-dim'
                      : 'border border-line-strong bg-surface-2 text-muted',
                ].join(' ')}
              >
                {drafter.mark}
              </span>
              <span
                className={[
                  'w-full truncate text-center font-display text-[9px] font-medium uppercase leading-none tracking-[0.12em] transition-colors duration-300 ease-out',
                  index === active ? 'text-ink' : 'text-dim',
                ].join(' ')}
              >
                {drafter.name}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
