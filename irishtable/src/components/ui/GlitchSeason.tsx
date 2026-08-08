import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface GlitchSeasonProps {
  text?: string;
  className?: string;
}

function toSusan(word: string): string {
  if (word === "SEASON") return "SUSAN";
  if (word === "Season") return "Susan";
  if (word === "season") return "susan";
  return word.replace(/season/gi, (match) => {
    if (match === "SEASON") return "SUSAN";
    if (match === "Season") return "Susan";
    return "susan";
  });
}

export function GlitchSeason({ text = "season", className }: GlitchSeasonProps) {
  const [glitched, setGlitched] = useState(false);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    function scheduleNextGlitch() {
      const delay = 3000 + Math.random() * 2000;
      timeoutId = setTimeout(() => {
        setGlitched(true);
        setTimeout(() => {
          setGlitched(false);
          scheduleNextGlitch();
        }, 380);
      }, delay);
    }

    scheduleNextGlitch();

    return () => clearTimeout(timeoutId);
  }, []);

  const glitchedText = toSusan(text);

  return (
    <span className={cn("relative inline-block select-none align-baseline", className)}>
      {/* 1. Invisible baseline placeholder reserving layout dimensions — space occupied never changes */}
      <span className="invisible opacity-0 pointer-events-none" aria-hidden>
        {text}
      </span>

      {/* 2. Primary text layer */}
      <span className="absolute inset-0 flex items-center justify-center">
        {glitched ? glitchedText : text}
      </span>

      {/* 3. Sliced clip-path top overlay (strictly monochromatic) */}
      {glitched && (
        <span
          aria-hidden
          className="absolute inset-0 flex items-center justify-center animate-glitch-slice-top pointer-events-none"
        >
          {glitchedText}
        </span>
      )}

      {/* 4. Sliced clip-path bottom overlay (strictly monochromatic) */}
      {glitched && (
        <span
          aria-hidden
          className="absolute inset-0 flex items-center justify-center animate-glitch-slice-bottom pointer-events-none"
        >
          {glitchedText}
        </span>
      )}
    </span>
  );
}
