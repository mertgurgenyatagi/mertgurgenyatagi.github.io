import { useId, useState } from 'react'

interface ActionBarProps {
  onCreate: () => void
  onJoin: (code: string) => void
}

/** No I, O, 0 or 1 anywhere in a lobby code — they get read aloud and typed by hand. */
const CODE_PATTERN = /[^A-HJ-NP-Z2-9-]/g

/**
 * The bottom bar. Creating a lobby owns the left edge on its own; joining an
 * existing one is a field and a quieter button, pushed to the right.
 */
export function ActionBar({ onCreate, onJoin }: ActionBarProps) {
  const [code, setCode] = useState('')
  const codeId = useId()

  const trimmed = code.trim()
  const canJoin = trimmed.length >= 4

  return (
    <div>
      <div className="fx fx-draw h-px w-full bg-line-strong" style={{ animationDelay: '1180ms' }} />

      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (canJoin) onJoin(trimmed)
        }}
        className="fx fx-rise mt-[clamp(0.5rem,2vh,1.25rem)] flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
        style={{ animationDelay: '1240ms' }}
      >
        <button
          type="button"
          onClick={onCreate}
          className="shrink-0 rounded-sm border border-accent bg-accent px-6 py-[11px] sm:py-[13px] font-display text-[12px] font-medium uppercase tracking-[0.09em] text-accent-ink transition-[transform,background-color,border-color] duration-100 ease-out hover:bg-transparent hover:text-accent active:translate-y-px sm:px-8"
        >
          Create a lobby
        </button>

        <div className="flex items-stretch gap-2 sm:gap-3">
          <label htmlFor={codeId} className="sr-only">
            Room code
          </label>
          <input
            id={codeId}
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase().replace(CODE_PATTERN, '').slice(0, 8))}
            placeholder="Enter room code"
            autoComplete="off"
            spellCheck={false}
            className="tabular w-full min-w-0 rounded-sm border border-line-strong bg-ground/60 px-4 py-[11px] sm:py-[13px] font-display text-[12px] uppercase tracking-[0.14em] text-ink transition-colors duration-100 ease-out placeholder:tracking-[0.09em] hover:border-line focus:border-accent-line focus:outline-none sm:w-[16rem]"
          />
          <button
            type="submit"
            disabled={!canJoin}
            className="shrink-0 rounded-sm border border-line-strong px-5 py-[11px] sm:py-[13px] font-display text-[12px] font-medium uppercase tracking-[0.09em] text-ink transition-[transform,border-color,color,opacity] duration-100 ease-out hover:border-ink active:translate-y-px disabled:border-line disabled:text-dim disabled:hover:border-line sm:px-7"
          >
            Join lobby
          </button>
        </div>
      </form>
    </div>
  )
}
