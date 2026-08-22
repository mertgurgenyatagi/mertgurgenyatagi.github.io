import { clubLeagues } from '../../data/clubs'
import { crestUrl } from '../../lib/players'
import { Crest } from '../ui/Crest'
import { SectionLabel } from '../ui/SectionLabel'
import { useI18n } from '../../lib/i18n'

interface SpentCrestsProps {
  constraint: string
  /** Club slugs, in the order you took them. */
  clubs: string[]
  clubNames: Record<string, string>
  /** Nations, in the order you took them. Used when the constraint counts those. */
  nations: string[]
}

/**
 * What your own picks have used up. Crests sit at a third of their weight: a
 * record of what is gone, not a set of things to look at. The dimming is
 * opacity on the whole mark, never a filter or a greyscale — a recoloured
 * badge is a falsified badge.
 */
export function SpentCrests({ constraint, clubs, clubNames, nations }: SpentCrestsProps) {
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
                className="h-[24px] w-[24px] opacity-[0.34]"
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
              className="fx fx-pop font-display text-[10px] font-medium uppercase tracking-[0.1em] text-dim"
            >
              {nation}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
