interface StatusLineProps {
  message: string
  /** Optional key to re-trigger fade-in when the message updates */
  statusKey?: number | string
  className?: string
}

/**
 * Standardized status notification line.
 * Occupies fixed vertical space to prevent content shunting, with polite live announcement.
 */
export function StatusLine({ message, statusKey, className = '' }: StatusLineProps) {
  return (
    <p
      key={statusKey}
      aria-live="polite"
      className={`fx fx-fade h-4 truncate font-sans text-[11px] leading-4 text-muted md:h-5 md:text-[12px] md:leading-5 ${className}`.trim()}
    >
      {message}
    </p>
  )
}
