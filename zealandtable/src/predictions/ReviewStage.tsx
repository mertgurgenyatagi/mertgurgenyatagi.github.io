import { Pencil } from "lucide-react";
import { Frame, FrameBody, FrameHeader, FrameTitle } from "@/components/ui/frame";
import { RankingList } from "./RankingList";
import { AWARDS, candidateName, type AwardId } from "@/data/awards";
import type { AwardPicks } from "./predictionTypes";

interface ReviewStageProps {
  table: string[];
  awards: AwardPicks;
  /** Jump back to the table stage. */
  onEditTable: () => void;
  /** Jump back to one award's stage. */
  onEditAward: (awardId: AwardId) => void;
  onSubmit: () => void;
  submitting: boolean;
  error: string | null;
}

/**
 * The last stage: everything just picked, in one frame, with a way back to
 * any of it.
 *
 * No parent template — kupatakipucl's flow ends the moment the table is
 * ranked, because the table is the whole prediction there. Twenty-eight picks
 * made across ten stages need a look before they are written, so this exists.
 * It is built out of pieces that already exist rather than new ones: `Frame`,
 * and `RankingList` for the table itself.
 */
export function ReviewStage({
  table,
  awards,
  onEditTable,
  onEditAward,
  onSubmit,
  submitting,
  error,
}: ReviewStageProps) {
  return (
    <div className="flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-4">
      <div className="flex flex-col items-center gap-1.5">
        <p className="text-center font-display text-2xl font-light text-color_text">
          One last look.
        </p>
        <p className="text-center text-sm text-color_textsecondary">
          Nothing is saved until you send it.
        </p>
      </div>

      <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
        <Frame>
          <FrameHeader tone="navy">
            <FrameTitle className="text-base text-color_text">Your table</FrameTitle>
            <button
              type="button"
              onClick={onEditTable}
              className="flex cursor-pointer items-center gap-1.5 rounded-full px-2 py-1 font-mono text-[0.62rem] tracking-[0.14em] text-color_text/70 uppercase transition-colors duration-150 hover:text-color_text"
            >
              <Pencil className="size-3" aria-hidden />
              Edit
            </button>
          </FrameHeader>
          <FrameBody className="px-4 py-3">
            <RankingList ranking={table} />
          </FrameBody>
        </Frame>

        <Frame>
          <FrameHeader tone="navy">
            <FrameTitle className="text-base text-color_text">Cups and awards</FrameTitle>
          </FrameHeader>
          <FrameBody className="flex flex-col gap-1.5 px-4 py-3">
            {AWARDS.map((award) => {
              const pick = awards[award.id];
              return (
                <div
                  key={award.id}
                  className="flex items-center gap-3 rounded-lg border border-color_border1/50 bg-background px-4 py-2.5"
                >
                  <span className="min-w-0 flex-1 truncate font-mono text-[0.62rem] tracking-[0.14em] text-color_textsecondary uppercase">
                    {award.label}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-right font-display text-sm text-color_text">
                    {pick ? candidateName(award.id, pick) : "—"}
                  </span>
                  <button
                    type="button"
                    aria-label={`Edit ${award.label}`}
                    onClick={() => onEditAward(award.id)}
                    className="flex shrink-0 cursor-pointer items-center justify-center rounded-full p-1 text-color_textsecondary transition-colors duration-150 hover:text-color_text"
                  >
                    <Pencil className="size-3.5" aria-hidden />
                  </button>
                </div>
              );
            })}
          </FrameBody>
        </Frame>
      </div>

      <div className="flex shrink-0 flex-col items-center gap-2">
        <button
          type="button"
          disabled={submitting}
          onClick={onSubmit}
          className="cursor-pointer rounded-full bg-color_text px-8 py-3.5 text-base font-semibold text-background transition-opacity disabled:cursor-default disabled:opacity-40"
        >
          {submitting ? "Sending…" : "Send it"}
        </button>
        {error && (
          <p role="alert" className="text-center text-sm text-color_remove">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
