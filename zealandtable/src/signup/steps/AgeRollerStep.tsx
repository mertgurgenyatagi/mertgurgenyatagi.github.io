import { useEffect, useRef, useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEM_HEIGHT = 48;
const VISIBLE_ROWS = 5;

interface AgeRollerStepProps {
  min: number;
  max: number;
  defaultValue: number;
  onConfirm: (value: number) => void;
}

/** An iOS-style scroll-snap wheel — no picker library exists in this repo,
 *  and the whole interaction is one CSS scroll-snap container plus a scroll
 *  listener rounding to the nearest item, so nothing extra was worth adding
 *  for it. Padding top/bottom is (VISIBLE_ROWS - 1) / 2 rows so the first
 *  and last real values can still scroll to dead center. */
export function AgeRollerStep({ min, max, defaultValue, onConfirm }: AgeRollerStepProps) {
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const containerRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(defaultValue);
  const padRows = (VISIBLE_ROWS - 1) / 2;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = (defaultValue - min) * ITEM_HEIGHT;
    // Deliberately empty deps — only ever run once, on mount. A user-driven
    // scroll afterward should never get overridden by this effect re-firing.
  }, []);

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    const index = Math.round(el.scrollTop / ITEM_HEIGHT);
    const clamped = Math.min(values.length - 1, Math.max(0, index));
    setValue(values[clamped]);
  }

  // Desktop mouse wheel/trackpad scroll over the wheel wasn't reliably
  // reaching it (Mert: had to use the keyboard) — explicit step buttons as
  // a guaranteed-working alternative, not just a nicety.
  function step(delta: number) {
    const next = Math.min(max, Math.max(min, value + delta));
    setValue(next);
    containerRef.current?.scrollTo({ top: (next - min) * ITEM_HEIGHT, behavior: "smooth" });
  }

  const arrowClass =
    "flex cursor-pointer items-center justify-center rounded-full p-1.5 text-color_text transition-colors duration-150 ease-[var(--ease-cotton)] hover:bg-color_text hover:text-background disabled:pointer-events-none disabled:opacity-30";

  return (
    <div className="flex flex-col items-center gap-8">
      <p className="text-center font-display text-2xl font-light text-color_text">How old are you?</p>
      <div className="flex flex-col items-center gap-1">
        {/* Values increase going down the list (min at top, max at bottom)
            — the up arrow reveals what's above it in that list, i.e. a
            smaller value, matching the wheel's own scroll direction rather
            than a plain increment-stepper reading. */}
        <button type="button" aria-label="Decrease age" disabled={value <= min} onClick={() => step(-1)} className={arrowClass}>
          <ChevronUp className="size-6" />
        </button>
        <div className="relative">
          <div
            ref={containerRef}
            onScroll={handleScroll}
            role="listbox"
            aria-label="Age"
            className="no-scrollbar snap-y snap-mandatory overflow-y-auto"
            style={{ height: ITEM_HEIGHT * VISIBLE_ROWS, width: 160, paddingBlock: ITEM_HEIGHT * padRows }}
          >
            {values.map((v) => (
              <div
                key={v}
                role="option"
                aria-selected={v === value}
                className={cn(
                  "flex snap-center items-center justify-center font-display text-3xl tabular-nums transition-opacity duration-150",
                  v === value ? "text-color_text opacity-100" : "text-color_text/30"
                )}
                style={{ height: ITEM_HEIGHT }}
              >
                {v}
              </div>
            ))}
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 border-y border-color_text/20"
            style={{ height: ITEM_HEIGHT }}
          />
        </div>
        <button type="button" aria-label="Increase age" disabled={value >= max} onClick={() => step(1)} className={arrowClass}>
          <ChevronDown className="size-6" />
        </button>
      </div>
      <button
        type="button"
        onClick={() => onConfirm(value)}
        className="cursor-pointer rounded-full bg-color_text px-8 py-3.5 text-base font-semibold text-background"
      >
        Continue
      </button>
    </div>
  );
}
