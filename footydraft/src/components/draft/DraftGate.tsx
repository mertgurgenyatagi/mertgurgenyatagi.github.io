import { BackHome } from '../ui/BackHome'
import { LanguageSwitch } from '../ui/LanguageSwitch'
import { useI18n } from '../../lib/i18n'

/**
 * What a draft screen draws before it knows who you are.
 *
 * All four screens used to compute your seat as `Math.max(0, findIndex(...))`,
 * which resolves to **0** — the host's seat — for however many renders it takes
 * the room to arrive. In that window a guest was drawn as the host, read the
 * host's board, and could act on the host's behalf; and anything that indexed
 * off a seat that did not exist yet (`drafters[holder].name`, a squad, a
 * budget) reached into an empty array and took the screen down with it. That
 * is the black screen non-hosts were getting.
 *
 * So a screen that does not yet have a seat for you renders this instead of
 * guessing. It is deliberately a real screen with the way out on it rather
 * than a spinner: if the room never resolves, the one thing you need is the
 * door.
 */
export function DraftGate({ message }: { message?: string }) {
  const { t } = useI18n()

  return (
    <div className="draft flex h-full w-full flex-col px-[var(--app-inset-x)] py-[var(--app-inset-y)]">
      <div className="flex shrink-0 items-center justify-between gap-5 border-b border-line py-[12px]">
        <BackHome />
        <LanguageSwitch />
      </div>

      <div className="grid min-h-0 flex-1 place-items-center">
        <p className="flex items-center gap-[12px]">
          <span
            aria-hidden="true"
            className="narrator-pulse h-[9px] w-[9px] shrink-0 rounded-full bg-live"
          />
          <span className="font-display text-[length:var(--draft-narrator)] font-semibold uppercase tracking-[0.06em] text-ink">
            {message ?? t('Taking your seat')}
          </span>
        </p>
      </div>
    </div>
  )
}
