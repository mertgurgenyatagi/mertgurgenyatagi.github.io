import { SectionLabel } from '../ui/SectionLabel'
import { useI18n } from '../../lib/i18n'

interface DraftClockProps {
  round: number
  rounds: number
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`
}

/** Just which round it is. The countdown and the pick count were noise next to it. */
export function DraftClock({ round, rounds }: DraftClockProps) {
  const { t } = useI18n();

  return (
    <section className="flex shrink-0 flex-col gap-[8px]">
      <SectionLabel>{t("Round")}</SectionLabel>
      <span className="font-display text-[length:var(--draft-clock)] font-medium uppercase leading-[0.78] text-ink">
        {ordinal(round)} round
      </span>
      <span className="text-[11px] leading-[1.4] text-dim">of {rounds}</span>
    </section>
  )
}
