import { clubLeagues } from '../../data/clubs'
import { crestUrl } from '../../lib/players'
import { Crest } from '../ui/Crest'
import { SectionLabel } from '../ui/SectionLabel'
import { useI18n } from '../../lib/i18n'

interface SpentCrestsProps {
  constraint: string
  /** Club slugs the **table** has spent, in the order they went. */
  clubs: string[]
  clubNames: Record<string, string>
  /** Nations the table has spent. Used when the constraint counts those. */
  nations: string[]
  /** Which of those you spent yourself. Drawn at full weight. */
  yoursClubs?: ReadonlySet<string>
  yoursNations?: ReadonlySet<string>
}

/**
 * What the table's picks have used up.
 *
 * **This used to be your own picks alone**, which was right while a constraint
 * was a property of your own squad. Constraints are shared now *(2026-08-23)*:
 * a club goes when anybody at the table takes it, so a panel headed `Used` that
 * listed only your own would be answering a question nobody asked while getting
 * the one they did ask wrong.
 *
 * Crests sit at a third of their weight — a record of what is gone, not a set
 * of things to look at — and the ones **you** spent are drawn at full weight,
 * so the two readings live in the same list rather than needing two. The
 * dimming is opacity on the whole mark, never a filter or a greyscale: a
 * recoloured badge is a falsified badge.
 */
export function SpentCrests({
  constraint,
  clubs,
  clubNames,
  nations,
  yoursClubs,
  yoursNations,
}: SpentCrestsProps) {
  const { t } = useI18n();

  const byClub = constraint.startsWith('club')

  return (
    <section className="flex shrink-0 flex-col gap-[10px]">
      <SectionLabel>{t("Used")}</SectionLabel>

      {byClub ? (
        <ul className="flex flex-wrap items-center gap-[10px]">
          {clubs.map((slug) => (
            <li key={slug} className="fx fx-pop">
              {/* A club outside the top five has no mark and never will, so it
                  spends as the ring stand-in rather than as a broken image. */}
              <Crest
                className={`h-[24px] w-[24px] ${yoursClubs?.has(slug) ? 'opacity-100' : 'opacity-[0.34]'}`}
                src={clubLeagues[slug] ? crestUrl(slug) : null}
                alt={clubNames[slug] ?? slug}
                title={clubNames[slug] ?? slug}
              />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="flex flex-wrap items-center gap-x-[10px] gap-y-[5px]">
          {nations.map((nation) => (
            <li
              key={nation}
              className={[
                'fx fx-pop font-display text-[10px] font-medium uppercase tracking-[0.1em]',
                yoursNations?.has(nation) ? 'text-ink' : 'text-dim',
              ].join(' ')}
            >
              {nation}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
