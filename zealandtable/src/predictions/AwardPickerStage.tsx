import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { searchCandidates, type Award } from "@/data/awards";

interface AwardPickerStageProps {
  award: Award;
  index: number;
  total: number;
  value?: string | null;
  onPick: (candidateId: string) => void;
}

export function AwardPickerStage({ award, index, total, value, onPick }: AwardPickerStageProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(value ?? null);

  const results = useMemo(() => searchCandidates(award, query), [award, query]);

  // Cup awards (10 candidates) use the crest grid; all player & manager awards use the vertical list
  const isGrid = award.id === "faCup" || award.id === "carabao";

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <div className="flex flex-col items-center gap-2">
        <span className="type-label text-accent uppercase tnum">
          AWARD {index} OF {total} · {award.points} {award.points === 1 ? "POINT" : "POINTS"}
        </span>
        <p className="max-w-lg text-balance text-center type-display text-2xl sm:text-3xl text-color_text">
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
            className="w-full rounded-full border border-color_border2 bg-color_main py-3 pr-6 pl-12 text-sm text-color_text placeholder:text-color_textsecondary outline-none transition-colors duration-150 ease-[var(--ease-cotton)] focus:border-color_accent"
          />
        </div>
      )}

      {results.length === 0 ? (
        <p className="py-6 text-center type-label text-color_textsecondary italic">
          NOTHING MATCHES THAT.
        </p>
      ) : isGrid ? (
        <div className="no-scrollbar grid max-h-[42vh] w-full max-w-lg grid-cols-2 gap-2.5 overflow-y-auto sm:grid-cols-5">
          {results.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              title={candidate.name}
              onClick={() => setSelected(candidate.id)}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-color_border1 bg-color_secondary p-3 text-color_text transition-all duration-150 ease-[var(--ease-cotton)] hover:border-color_accent hover:bg-hoverfill",
                selected === candidate.id && "bg-color_accent text-color_main border-color_accent font-semibold shadow-sm"
              )}
            >
              {candidate.crest && (
                <img src={candidate.crest} alt="" className="size-9 shrink-0 object-contain" />
              )}
              <span className="w-full truncate text-center font-display text-xs leading-tight uppercase">
                {candidate.name}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="no-scrollbar flex max-h-[40vh] w-full max-w-lg flex-col gap-2 overflow-y-auto px-1">
          {results.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              onClick={() => setSelected(candidate.id)}
              className={cn(
                "flex shrink-0 cursor-pointer items-center gap-3 rounded-full border border-color_border1 bg-color_secondary px-4 py-2.5 text-left text-sm text-color_text transition-all duration-150 ease-[var(--ease-cotton)] hover:border-color_accent hover:bg-hoverfill",
                selected === candidate.id && "bg-color_accent text-color_main border-color_accent font-semibold"
              )}
            >
              {candidate.crest && (
                <img src={candidate.crest} alt="" className="size-6 shrink-0 object-contain" />
              )}
              <span className="min-w-0 flex-1 truncate font-sans text-sm">{candidate.name}</span>
              {candidate.subtitle && (
                <span className="shrink-0 type-label text-[0.65rem] opacity-75 uppercase">
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
        className="cursor-pointer rounded-full bg-color_accent px-8 py-3 type-display text-sm text-color_main transition-all duration-150 hover:bg-color_accent/85 disabled:cursor-not-allowed disabled:opacity-40"
      >
        CONTINUE
      </button>
    </div>
  );
}
