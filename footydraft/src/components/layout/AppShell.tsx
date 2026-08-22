import type { ReactNode } from 'react'
import { AmbientBackdrop } from './AmbientBackdrop'

/**
 * Top-level application shell.
 *
 * Two jobs. It keeps the ambient backdrop alive across navigation, and it owns
 * **the frame** every route is drawn inside — see `.app-frame` in index.css.
 * The frame is one bottom inset, declared once, plus a size container: a route
 * asks the frame how tall it is rather than asking the window, so the room a
 * browser's own chrome takes is subtracted before any screen starts dividing
 * its height up. No route sizes itself against the viewport any more.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-ground text-ink select-none">
      <AmbientBackdrop />
      <div className="app-frame relative z-10 h-full w-full overflow-hidden">
        {children}
      </div>
    </div>
  )
}
