import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { searchCandidates, type Award } from "@/data/awards";

interface AwardPickerStageProps {
  award: Award;
  /** 1-based position of this award in the run, for the "3 of 8" eyebrow. */
  index: number;
  total: number;
  /** Seeds the selection when revisiting a stage — going back, or editing an
   *  existing prediction from the profile page. */
  value?: string | null;
  onPick: (candidateId: string) => void;
}

/**
 * One award stage: name, blurb, shortlist, confirm.
 *
 * This is the piece with no parent template — kupatakipucl predicts nothing
 * but a table, so it has no award step to clone. Built in the flow's own
 * idiom instead of inventing a third: `ChoiceStep`'s pill geometry and
 * select-then-confirm rule, `CountryStep`'s filter box for the shortlists too
 * long to fit (Player of the Season runs to hundreds), and the same continue
 * pill as every other stage.
 *
 * The shortlists come from `@/data/awards.ts`, which derives every one of
 * them from clubs.ts / people.ts — nothing is listed twice, so correcting a
 * squad fixes every picker at once.
 */
export function AwardPickerStage({ award, index, total, value, onPick }: AwardPickerStageProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(value ?? null);

  const results = useMemo(() => searchCandidates(award, query), [award, query]);

  // Clubs are a short list with crests; players and managers are long lists
  // where the club is a subtitle. One layout reads badly for both, so the
  // shortlist picks its own shape from its own size.
  const isGrid = award.candidates.length <= 24;

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <div className="flex flex-col items-center gap-2">
        <span className="font-mono text-[0.62rem] tracking-[0.24em] text-color_textsecondary uppercase tnum">
          Award {index} of {total} · {award.points} {award.points === 1 ? "point" : "points"}
        </span>
        <p className="max-w-lg text-balance text-center font-display text-2xl font-light text-color_text">
          {award.label}
        </p>
        <p className="max-w-md text-balance text-center text-sm text-color_textsecondary">{award.blurb}</p>
      </div>

      {!isGrid && (
        <div className="relative w-full max-w-lg">
          <Search
            className="pointer-events-none absolute top-1/2 left-5 size-4 -translate-y-1/2 text-color_text/40"
            aria-hidden
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${award.searchNoun}…`}
            aria-label={`Search ${award.searchNoun}`}
            className="w-full rounded-full border border-color_text/45 bg-background py-3 pr-6 pl-12 text-base font-light text-color_text placeholder:text-color_text/40 outline-none transition-colors duration-150 ease-[var(--ease-cotton)] focus:border-color_accent"
          />
        </div>
      )}

      {results.length === 0 ? (
        <p className="py-6 text-center font-display text-sm text-color_textsecondary italic">
          Nothing matches that.
        </p>
      ) : isGrid ? (
        <div className="no-scrollbar grid max-h-[42vh] w-full max-w-lg grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-5">
          {results.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              title={candidate.name}
              onClick={() => setSelected(candidate.id)}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-color_text/45 bg-background p-2 text-color_text transition-colors duration-150 ease-[var(--ease-cotton)] hover:bg-color_text hover:text-background",
                selected === candidate.id && "bg-color_text text-background ring-2 ring-color_accent"
              )}
            >
              {candidate.crest && (
                <img src={candidate.crest} alt="" className="size-9 shrink-0 object-contain" />
              )}
              <span className="w-full truncate text-center font-display text-[0.6rem] leading-tight">
                {candidate.name}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="no-scrollbar flex max-h-[38vh] w-full max-w-lg flex-col gap-2 overflow-y-auto">
          {results.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              onClick={() => setSelected(candidate.id)}
              className={cn(
                "flex shrink-0 cursor-pointer items-center gap-3 rounded-full border border-color_text/45 bg-background px-4 py-2.5 text-left text-sm font-light text-color_text transition-colors duration-150 ease-[var(--ease-cotton)] hover:bg-color_text hover:text-background",
                selected === candidate.id && "bg-color_text text-background ring-2 ring-color_accent"
              )}
            >
              {candidate.crest && (
                <img src={candidate.crest} alt="" className="size-6 shrink-0 object-contain" />
              )}
              <span className="min-w-0 flex-1 truncate">{candidate.name}</span>
              {candidate.subtitle && (
                <span className="shrink-0 font-mono text-[0.6rem] tracking-[0.12em] uppercase opacity-60">
                  {candidate.subtitle}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        disabled={selected === null}
        onClick={() => selected && onPick(selected)}
        className="cursor-pointer rounded-full bg-color_text px-8 py-3.5 text-base font-semibold text-background transition-opacity disabled:cursor-default disabled:opacity-40"
      >
        Continue
      </button>
    </div>
  );
}
