import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant = 'accent' | 'surface' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
}

/**
 * Standardized button primitive adhering to the app's design tokens.
 * - 'accent': Primary CTA with gold fill, crisp border, and hover inverse
 * - 'surface': Secondary action with surface-2 fill and line-strong border
 * - 'ghost': Quiet text action (e.g. Back to home, Cancel)
 */
export function Button({
  variant = 'surface',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center font-display font-semibold uppercase tracking-[0.1em] transition-[background-color,border-color,color,transform] duration-150 ease-out select-none active:translate-y-px disabled:pointer-events-none'

  const variants: Record<ButtonVariant, string> = {
    accent:
      'rounded-sm border border-accent bg-accent text-accent-ink hover:bg-transparent hover:text-accent disabled:border-line disabled:bg-transparent disabled:text-faint',
    surface:
      'rounded-sm border border-line bg-surface text-ink hover:border-line-strong hover:bg-surface-2 disabled:border-line disabled:text-dim',
    ghost:
      'border-0 bg-transparent text-[10px] font-medium tracking-[0.2em] text-muted hover:text-ink disabled:text-faint',
  }

  const sizes: Record<'sm' | 'md' | 'lg', string> = {
    sm: 'px-3 py-[5px] text-[10px] tracking-[0.16em]',
    md: 'px-[clamp(1rem,3vw,2.5rem)] py-[clamp(0.5rem,1.6vh,1.125rem)] text-[clamp(0.75rem,1.1vw,0.9375rem)]',
    lg: 'px-7 py-[13px] text-[12px]',
  }

  const sizeClass = variant === 'ghost' ? '' : sizes[size]

  return (
    <button
      {...props}
      className={`${base} ${variants[variant]} ${sizeClass} ${className}`.trim()}
    >
      {children}
    </button>
  )
}
