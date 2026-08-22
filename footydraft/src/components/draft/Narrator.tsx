export type NarratorTone = 'you' | 'waiting' | 'settled'

interface NarratorProps {
  text: string
  tone: NarratorTone
  /** Changes whenever the line does, so the fade re-runs on an identical string. */
  beat: number
}

/**
 * The line across the top that says what is happening — **centred**, and set
 * large enough to be the first thing read on the screen.
 *
 * It reports and nothing else: who is on the clock, what they took, when the
 * round turned over. It is not a commentator and has no voice — no banter, no
 * exclamation, no second-person enthusiasm. A drafter who looks away for ten
 * seconds should be able to look back at this one line and know exactly where
 * the draft is, which is an argument for size rather than for more words.
 *
 * One dot and one sentence, and that is the whole component. The dot is the
 * only state the line does not spell out: gold is yours, green is somebody
 * else being present, grey is history.
 */
export function Narrator({ text, tone, beat }: NarratorProps) {
  return (
    <p
      aria-live="polite"
      className="flex min-w-0 items-center justify-center gap-[12px]"
    >
      <span
        aria-hidden="true"
        className={[
          'h-[9px] w-[9px] shrink-0 rounded-full',
          tone === 'you'
            ? 'bg-accent'
            : tone === 'waiting'
              ? 'bg-live narrator-pulse'
              : 'bg-line-strong',
        ].join(' ')}
      />
      <span
        key={beat}
        className={[
          'fx fx-soft truncate text-center font-display text-[length:var(--draft-narrator)] font-semibold uppercase tracking-[0.06em]',
          tone === 'you' ? 'text-accent' : 'text-ink',
        ].join(' ')}
      >
        {text}
      </span>
    </p>
  )
}
