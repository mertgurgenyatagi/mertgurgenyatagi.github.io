import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { COUNTRIES, searchCountries } from "@/data/countries";

interface CountryStepProps {
  onSelect: (code: string) => void;
  initialSelection?: string | null;
}

/**
 * irishtable's own quiz question — the parent has no equivalent, because a
 * Turkish-language project could assume where its audience lived and this one
 * cannot.
 *
 * Every other step in this flow puts its options on screen at once. 202
 * countries can't be, so this is the one step with a filter box: same pill
 * geometry and same select-then-confirm rule as `ChoiceStep`, in a bounded
 * scroll list instead of a full column. The list is pre-sorted by name in
 * `countries.ts`, so nothing re-sorts at render time.
 */
export function CountryStep({ onSelect, initialSelection }: CountryStepProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(initialSelection ?? null);

  const results = useMemo(() => (query.trim() ? searchCountries(query) : COUNTRIES), [query]);

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <p className="max-w-lg text-balance text-center font-display text-2xl font-light text-color_text">
        Where are you from?
      </p>

      <div className="relative w-full max-w-lg">
        <Search
          className="pointer-events-none absolute top-1/2 left-5 size-4 -translate-y-1/2 text-color_text/40"
          aria-hidden
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search countries…"
          aria-label="Search countries"
          className="w-full rounded-full border border-color_text/45 bg-background py-3.5 pr-6 pl-12 text-base font-light text-color_text placeholder:text-color_text/40 outline-none transition-colors duration-150 ease-[var(--ease-cotton)] focus:border-color_accent"
        />
      </div>

      <div className="no-scrollbar flex max-h-[38vh] w-full max-w-lg flex-col gap-2.5 overflow-y-auto">
        {results.length === 0 ? (
          <p className="py-6 text-center font-display text-sm text-color_textsecondary italic">
            No country matches that.
          </p>
        ) : (
          results.map((country) => (
            <button
              key={country.code}
              type="button"
              onClick={() => setSelected(country.code)}
              className={cn(
                "shrink-0 cursor-pointer rounded-full border border-color_text/45 bg-background px-5 py-3 text-center text-sm font-light text-color_text transition-colors duration-150 ease-[var(--ease-cotton)] hover:bg-color_text hover:text-background",
                selected === country.code && "bg-color_text text-background ring-2 ring-color_accent"
              )}
            >
              {country.name}
            </button>
          ))
        )}
      </div>

      <button
        type="button"
        disabled={selected === null}
        onClick={() => selected && onSelect(selected)}
        className="cursor-pointer rounded-full bg-color_text px-8 py-3.5 text-base font-semibold text-background transition-opacity disabled:cursor-default disabled:opacity-40"
      >
        Continue
      </button>
    </div>
  );
}
