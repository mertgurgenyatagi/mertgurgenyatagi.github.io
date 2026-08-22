import { useEffect, useState } from 'react'
import { SectionLabel } from '../ui/SectionLabel'
import { useI18n } from '../../lib/i18n'

interface RoomCodeProps {
  code: string
}

/**
 * The invite, and the reason the left half of this screen isn't the solo
 * lobby's. The code is the display type here — it's the thing being read out
 * over a call, so it gets the size and the tracking rather than a heading
 * above a list.
 *
 * Copy is real: the clipboard is one of the few things that works without a
 * server. The label reports back rather than a toast appearing somewhere else.
 */
export function RoomCode({ code }: RoomCodeProps) {
  const { t } = useI18n();

  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(timer)
  }, [copied])

  const copy = async () => {
    const link = `${window.location.origin}${window.location.pathname}#/lobby/${code}`
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      // An insecure origin, or permission refused. The code is on screen
      // either way, so there's nothing to recover — just don't claim it copied.
      setCopied(false)
    }
  }

  return (
    <div
      className="fx fx-soft mb-2 md:mb-0 md:mt-[clamp(0.4rem,1.6vh,1rem)]"
      style={{ animationDelay: '140ms' }}
    >
      {/* Below `md` the label goes and the code shrinks onto one row with the
          copy — the seats and four settings groups have to land above the fold
          on a 568px-tall screen, and this block is where the room comes from. */}
      <SectionLabel className="hidden md:block">{t("Room code")}</SectionLabel>

      <div className="flex items-center justify-between gap-4 md:mt-[clamp(0.2rem,0.8vh,0.5rem)]">
        <span className="tabular truncate font-display text-[19px] font-bold uppercase leading-[1.2] tracking-[0.18em] text-ink md:text-[clamp(1.75rem,4.4vw,3rem)] md:leading-[1]">
          {code}
        </span>

        <button
          type="button"
          onClick={copy}
          /* The one blue control in the app. Copying the invite is the only
             action that sends something out of #footydraft rather than
             changing something inside it, so it is the only thing that gets
             the third accent. */
          className="shrink-0 rounded-sm border border-link bg-link px-3 py-[5px] font-display text-[10px] font-medium uppercase tracking-[0.16em] text-link-ink transition-colors duration-150 ease-out hover:border-link-hover hover:bg-link-hover md:py-[7px]"
        >
          <span
            key={String(copied)}
            className="fx fx-fade block"
            style={{ animationDuration: '260ms' }}
          >
            {copied ? 'Link copied' : 'Copy link'}
          </span>
        </button>
      </div>

      <p className="mt-[6px] hidden text-[10.5px] leading-[1.4] text-dim md:block">{t("Anyone with the code can take a seat.")}</p>
    </div>
  )
}
