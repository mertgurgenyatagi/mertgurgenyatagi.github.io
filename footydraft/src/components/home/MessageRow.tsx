import { useI18n } from '../../lib/i18n'
/**
 * Titles the bar underneath it. Used to swap in a format's description on
 * hover; that's gone now, so it's just the static title — and it no longer
 * reserves a tall band for a message it doesn't carry, which is where a good
 * part of the gap under the formats was coming from.
 */
export function MessageRow() {
  const { t } = useI18n();

  return (
    <div className="mt-[clamp(0.75rem,2.6cqh,1.75rem)] flex h-[clamp(1.5rem,3cqh,2.25rem)] items-center">
      <p
        className="fx fx-rise font-display text-[11px] font-medium uppercase tracking-[0.22em] text-accent"
        style={{ animationDelay: '1060ms' }}
      >{t("Play with friends")}</p>
    </div>
  )
}
