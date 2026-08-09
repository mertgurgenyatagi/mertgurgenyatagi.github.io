import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface IntroBeatProps {
  text: string;
  /** Exact substrings of `text` to render bold — e.g. the two numbers that
   *  actually matter in the scoring-rule sentence. */
  boldTerms?: string[];
  /** An optional illustration shown between the text and the continue
   *  button (the scoring-example diagram, on the middle beat). */
  visual?: ReactNode;
  onContinue: () => void;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderWithBold(text: string, boldTerms: string[]): ReactNode {
  if (boldTerms.length === 0) return text;
  const pattern = new RegExp(`\\b(${boldTerms.map(escapeRegExp).join("|")})\\b`, "g");
  return text
    .split(pattern)
    .filter((part) => part.length > 0)
    .map((part, i) => {
      if (boldTerms.includes(part)) {
        const isPoint = /\d/.test(part);
        return (
          <strong key={i} className={cn("font-extrabold text-color_text", isPoint && "text-color_cyan")}>
            {part}
          </strong>
        );
      }
      return <span key={i}>{part}</span>;
    });
}

/** One beat of the pre-ranking explanation — user-advanced, not timed: there's
 *  real information to read here, unlike signup's one-line welcome message.
 *  Same continue pill as ClubStep's own confirm button. */
export function IntroBeat({ text, boldTerms = [], visual, onContinue }: IntroBeatProps) {
  return (
    <div className="flex flex-col items-center gap-8 px-6">
      <p className="max-w-lg text-balance text-center font-display text-2xl font-light text-color_text sm:text-3xl">
        {renderWithBold(text, boldTerms)}
      </p>
      {visual}
      <button
        type="button"
        onClick={onContinue}
        className="cursor-pointer rounded-full bg-color_text px-8 py-3.5 text-base font-semibold text-background transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-color_accent"
      >
        Continue
      </button>
    </div>
  );
}
