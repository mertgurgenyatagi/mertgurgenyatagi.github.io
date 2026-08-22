import { formats } from '../../data/formats'
import { useI18n } from '../../lib/i18n'

interface FormatWallProps {
  onPick: (formatId: string) => void
}

/**
 * The four formats, all one size, under a titled rule. Picking one is meant to
 * open the single-player lobby; that lobby doesn't exist yet, so the page says
 * so rather than pretending.
 */
export function FormatWall({ onPick }: FormatWallProps) {
  const { t } = useI18n();

  return (
    <section aria-labelledby="single-player-heading">
      <h2
        id="single-player-heading"
        className="fx fx-rise font-display text-[11px] font-medium uppercase tracking-[0.22em] text-accent"
        style={{ animationDelay: '840ms' }}
      >{t("Single player")}</h2>

      <div
        className="fx fx-draw mt-[7px] h-px w-full bg-line-strong"
        style={{ animationDelay: '900ms' }}
      />

      {/* One column under 400px — "Deal or No Deal" wraps to two lines in a half
          width column at that size, and a two-line button label is a tell. */}
      <ul className="mt-3 grid grid-cols-1 gap-2 min-[400px]:grid-cols-2 sm:mt-4 sm:grid-cols-4 sm:gap-3">
        {formats.map((format, index) => (
          <li key={format.id} className="fx fx-rise" style={{ animationDelay: `${960 + index * 70}ms` }}>
            {/* Nothing moves on hover — the tile changes colour and grows a rule
                along its bottom edge instead. */}
            <button
              type="button"
              onClick={() => onPick(format.id)}
              className="group/format relative flex h-full w-full items-end overflow-hidden rounded-md border border-line-strong bg-surface/70 px-3 py-2 text-left transition-[border-color,background-color] duration-100 ease-out hover:border-accent-line hover:bg-accent-soft focus-visible:border-accent-line sm:px-4 sm:py-[13px]"
            >
              <span className="font-display text-[clamp(0.88rem,1.15vw,1.12rem)] font-medium uppercase leading-tight tracking-[0.05em] text-ink">
                {format.name}
              </span>

              {/* Slides in from the left edge as the tile lifts. */}
              <span
                aria-hidden="true"
                className="ml-auto translate-x-2 self-end pb-[2px] font-display text-sm text-accent opacity-0 transition-[opacity,transform] duration-100 ease-out group-hover/format:translate-x-0 group-hover/format:opacity-100 group-focus-visible/format:translate-x-0 group-focus-visible/format:opacity-100"
              >
                →
              </span>

              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-[2px] origin-left scale-x-0 bg-accent transition-transform duration-100 ease-out group-hover/format:scale-x-100 group-focus-visible/format:scale-x-100"
              />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
