import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from './Button'
import { SectionLabel } from './SectionLabel'

interface BackHomeProps {
  /** What the control says. `Back to home` everywhere but the friends lobby. */
  label?: string
  /**
   * Ask before leaving. Set on every draft screen: a draft is state that only
   * exists on this page, so leaving one by mis-clicking is the one navigation
   * in this app that costs something.
   */
  confirm?: boolean
  /** Drawn on the confirmation panel, under the heading. */
  confirmNote?: string
}

/**
 * Top left, on every screen but the home page, and drawn as a real button
 * rather than as a line of quiet label text — it is the only way out of a
 * screen that never scrolls, so it gets the weight of a control.
 */
export function BackHome({
  label = 'Back to home',
  confirm = false,
  confirmNote = 'The draft ends here. Nothing about it is saved.',
}: BackHomeProps) {
  const navigate = useNavigate()
  const [asking, setAsking] = useState(false)

  const leave = () => navigate('/')

  return (
    <>
      <button
        type="button"
        onClick={() => (confirm ? setAsking(true) : leave())}
        className="group/back inline-flex shrink-0 items-center gap-[7px] rounded-sm border border-line-strong bg-surface px-[12px] py-[7px] font-display text-[10.5px] font-semibold uppercase leading-none tracking-[0.16em] text-muted transition-[background-color,border-color,color] duration-150 ease-out hover:border-ink hover:bg-surface-2 hover:text-ink"
      >
        <span
          aria-hidden="true"
          className="text-[12px] leading-none transition-transform duration-150 ease-out group-hover/back:-translate-x-[2px]"
        >
          ←
        </span>
        {label}
      </button>

      {asking ? (
        <LeaveGate note={confirmNote} onCancel={() => setAsking(false)} onLeave={leave} />
      ) : null}
    </>
  )
}

/**
 * The same real `<dialog>` the name gate uses — the page behind it goes inert,
 * focus is trapped, and Escape cancels — with the non-modal fallback for
 * engines without `showModal`.
 */
function LeaveGate({
  note,
  onCancel,
  onLeave,
}: {
  note: string
  onCancel: () => void
  onLeave: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog || dialog.open) return

    if (typeof dialog.showModal === 'function') {
      try {
        dialog.showModal()
      } catch {
        dialog.open = true
      }
    } else {
      dialog.open = true
    }
  }, [])

  return (
    <dialog
      ref={ref}
      aria-label="Leave the draft"
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
      className="gate fixed inset-0 z-50 m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 text-ink"
    >
      <div className="fx fx-fade absolute inset-0 bg-shade/80" />

      <div className="relative grid h-full place-items-center p-[clamp(1rem,4vw,2rem)]">
        <div className="fx fx-soft gate-panel w-full max-w-[24rem] border border-line-strong bg-surface px-[clamp(1.25rem,4vw,2rem)] py-[clamp(1.25rem,4vw,1.875rem)]">
          <SectionLabel>Leaving</SectionLabel>

          <h2 className="mt-[clamp(0.5rem,2vh,0.875rem)] font-display text-[clamp(1.375rem,3.6vw,1.875rem)] font-bold uppercase leading-[0.95] tracking-[0.02em]">
            Back to home?
          </h2>

          <p className="mt-[7px] text-[11.5px] leading-[1.5] text-dim">{note}</p>

          <div className="mt-[clamp(0.875rem,3vh,1.375rem)] flex items-center justify-between gap-4">
            <Button type="button" variant="ghost" onClick={onCancel} autoFocus>
              Stay
            </Button>
            <Button type="button" variant="accent" size="lg" onClick={onLeave}>
              Leave →
            </Button>
          </div>
        </div>
      </div>
    </dialog>
  )
}
