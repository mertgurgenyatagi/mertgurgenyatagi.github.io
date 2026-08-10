import { useState } from "react";
import { cn } from "@/lib/utils";
import { TEAMS, teamCrestSrc } from "../../predictions/teams";
import { SUPPORT_NONE, SUPPORT_OTHER } from "@/predictions/surveyTypes";

// null = nothing chosen yet (confirm stays disabled); otherwise a club id or
// one of the two honest non-answers.
type Selection = string | null;

interface ClubStepProps {
  onSelect: (selection: string) => void;
  initialSelection?: Selection;
}

/**
 * 20 crests plus the two non-answers, sized to fit without any scrolling.
 * The parent runs 36 crests at 10 columns; 22 tiles fit comfortably in 8,
 * which keeps the tiles the same size rather than stretching them to fill.
 *
 * Select-and-confirm: tap a tile to mark it, tap another to change your
 * mind, then confirm — the template every other quiz question (ChoiceStep)
 * follows too. Reports the raw selection rather than collapsing "Another
 * club" / "No one in particular" to null, so revisiting this step (going
 * back, then forward again) can tell "answered none" from "not answered".
 */
export function ClubStep({ onSelect, initialSelection }: ClubStepProps) {
  const [selection, setSelection] = useState<Selection>(initialSelection ?? null);

  const tileClass = (active: boolean) =>
    cn(
      "flex size-14 cursor-pointer items-center justify-center rounded-xl border border-color_text/45 bg-background p-2 text-color_text transition-colors duration-150 ease-[var(--ease-cotton)] hover:bg-color_text hover:text-background",
      active && "bg-color_text text-background ring-2 ring-color_accent"
    );

  return (
    <div className="flex flex-col items-center gap-5">
      <p className="max-w-lg text-balance text-center font-display text-2xl font-light text-color_text">
        What team do you support?
      </p>
      <div className="grid w-fit grid-cols-8 gap-2">
        {TEAMS.map((team) => (
          <button
            key={team.id}
            type="button"
            title={team.name}
            onClick={() => setSelection(team.id)}
            className={tileClass(selection === team.id)}
          >
            <img src={teamCrestSrc(team.id)} alt={team.name} className="size-full object-contain" />
          </button>
        ))}
        <button
          type="button"
          title="Another club"
          onClick={() => setSelection(SUPPORT_OTHER)}
          className={cn(tileClass(selection === SUPPORT_OTHER), "font-mono text-[0.5rem] leading-tight font-light tracking-wide uppercase")}
        >
          Another
        </button>
        <button
          type="button"
          title="No one in particular"
          onClick={() => setSelection(SUPPORT_NONE)}
          className={cn(tileClass(selection === SUPPORT_NONE), "font-mono text-[0.5rem] leading-tight font-light tracking-wide uppercase")}
        >
          Nobody
        </button>
      </div>
      <button
        type="button"
        disabled={selection === null}
        onClick={() => selection && onSelect(selection)}
        className="cursor-pointer rounded-full bg-color_text px-8 py-3.5 text-base font-semibold text-background transition-opacity disabled:cursor-default disabled:opacity-40"
      >
        Continue
      </button>
    </div>
  );
}
