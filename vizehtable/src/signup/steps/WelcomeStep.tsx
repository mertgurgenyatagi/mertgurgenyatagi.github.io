/** Auto-dismissing (see AutoAdvance) — "vizeh" bold, "table" regular,
 *  matching the nav wordmark's own weight split (AppShell.tsx). leading-
 *  tight, not Tailwind's default text-6xl line-height of exactly 1 — that
 *  leaves no room for descenders. */
export function WelcomeStep() {
  return (
    <p className="text-center font-display text-5xl leading-tight text-color_text sm:text-6xl">
      <span className="font-bold">vizeh</span>
      <span className="font-normal">table — welcome.</span>
    </p>
  );
}
