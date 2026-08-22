import type { ReactNode } from 'react'

interface SectionLabelProps {
  children: ReactNode
  className?: string
}

/**
 * Standardized uppercase tracking label used across section headers and chip groups.
 */
export function SectionLabel({ children, className = '' }: SectionLabelProps) {
  return (
    <span
      className={`block font-display text-[10px] font-medium uppercase tracking-[0.2em] text-muted ${className}`.trim()}
    >
      {children}
    </span>
  )
}
