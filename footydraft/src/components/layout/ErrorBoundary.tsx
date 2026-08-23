import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useI18n } from '../../lib/i18n'

/**
 * The last thing between a render error and a black screen.
 *
 * There was nothing here, and an unhandled error in any route therefore
 * unmounted the whole tree — leaving the shell's own near-black ground and
 * nothing on it. That is the "non-hosts suddenly get a dark screen" report
 * exactly: whatever the underlying fault was on a given evening, the *symptom*
 * was always this, because a React tree that throws during render takes
 * everything with it and says nothing.
 *
 * The specific faults behind it are fixed elsewhere (see `normaliseBlock`,
 * `useSeats` and `DraftGate`). This is the net under them: a screen that
 * failed says so, keeps the way out, and prints what went wrong instead of
 * going quiet.
 */
interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Kept: this is the only record of what happened, and the message on
    // screen is deliberately not the stack.
    console.error('A screen failed to render:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return <Fallback error={this.state.error} onReset={() => this.setState({ error: null })} />
  }
}

function Fallback({ error, onReset }: { error: Error; onReset: () => void }) {
  const { t } = useI18n()

  return (
    <div className="grid h-full w-full place-items-center px-[var(--app-inset-x)] py-[var(--app-inset-y)]">
      <div className="flex max-w-[30rem] flex-col items-start gap-[14px] rounded-lg border border-line-strong bg-surface p-[clamp(1.25rem,4vw,2rem)]">
        <span className="font-display text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
          {t('Something broke')}
        </span>

        <h2 className="font-display text-[clamp(1.25rem,3.4vw,1.75rem)] font-bold uppercase leading-[0.95] tracking-[0.02em]">
          {t('This screen stopped.')}
        </h2>

        <p className="text-[11.5px] leading-[1.5] text-dim">
          {t('Nothing about the draft is saved, so there is nothing to recover. Going home and starting again is the whole fix.')}
        </p>

        <code className="max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded-sm border border-line bg-ground/60 px-[10px] py-[8px] font-mono text-[10.5px] leading-[1.5] text-faint">
          {error.message}
        </code>

        <div className="mt-[4px] flex items-center gap-[10px]">
          <a
            href="#/"
            onClick={onReset}
            className="inline-flex shrink-0 items-center gap-[7px] rounded-sm border border-accent bg-accent px-[14px] py-[8px] font-display text-[10.5px] font-semibold uppercase leading-none tracking-[0.16em] text-accent-ink transition-colors duration-150 ease-out hover:bg-transparent hover:text-accent"
          >
            {t('Back to home')}
          </a>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="shrink-0 rounded-sm border border-line-strong px-[14px] py-[8px] font-display text-[10.5px] font-semibold uppercase leading-none tracking-[0.16em] text-muted transition-colors duration-150 ease-out hover:border-ink hover:text-ink"
          >
            {t('Reload')}
          </button>
        </div>
      </div>
    </div>
  )
}
