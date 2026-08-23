import type { NarratorTone } from './Narrator'
import { SectionLabel } from '../ui/SectionLabel'
import { useI18n } from '../../lib/i18n'

export interface FeedLine {
  id: number
  text: string
  tone: NarratorTone
}

interface NarratorFeedProps {
  lines: FeedLine[]
}

/**
 * The narrator, given a panel instead of a line.
 *
 * Free Pick has one event per turn — somebody took somebody — and one line
 * across the top carries it. A spin has two, the wheel stopping and the pick
 * landing, and at four seats that is eighty-eight events over a draft. So the
 * latest report is set large at the top and the ones it replaced stay
 * underneath it, dimming as they go: look away for a turn and the panel tells
 * you what you missed rather than only where the draft is now.
 *
 * It still reports and nothing else — no banter, no exclamation, no second
 * person beyond `Your pick.` A 7px dot carries the state, accent when the
 * clock is on you and breathing while somebody else thinks.
 */
export function NarratorFeed({ lines }: NarratorFeedProps) {
  const { t } = useI18n();

  const [latest, ...older] = lines

  return (
    <section aria-label={t("Draft report")} className="spin-panel flex min-h-0 flex-1 flex-col p-[14px]">
      <SectionLabel className="shrink-0">{t("Report")}</SectionLabel>

      <p aria-live="polite" className="mt-[12px] flex shrink-0 items-start gap-[11px]">
        <span
          aria-hidden="true"
          className={[
            'mt-[7px] h-[7px] w-[7px] shrink-0 rounded-full transition-colors duration-300 ease-out',
            latest?.tone === 'you'
              ? 'bg-accent'
              : latest?.tone === 'waiting'
                ? 'narrator-pulse bg-muted'
                : 'bg-line-strong',
          ].join(' ')}
        />
        <span
          key={latest?.id ?? 'none'}
          className={[
            'fx fx-soft font-display text-[length:var(--spin-report)] font-medium uppercase leading-[1.24] tracking-[0.05em]',
            latest?.tone === 'you' ? 'text-accent' : 'text-ink',
          ].join(' ')}
        >
          {latest?.text ?? t('Waiting for the board.')}
        </span>
      </p>

      {older.length > 0 ? (
        <ul className="mt-[13px] min-h-0 flex-1 overflow-hidden border-t border-line pt-[10px]">
          {older.map((line, index) => (
            <li
              key={line.id}
              className="fx fx-soft truncate py-[3px] text-[11.5px] leading-[1.45] text-dim"
              style={{ opacity: 1 - index * 0.22 }}
            >
              {line.text}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-[13px] min-h-0 flex-1 border-t border-line" />
      )}
    </section>
  )
}
