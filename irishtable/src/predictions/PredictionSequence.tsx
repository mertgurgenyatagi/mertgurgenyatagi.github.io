import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft } from "lucide-react";
import { TeamRanker } from "./TeamRanker";
import { TEAMS } from "./teams";
import { IntroBeat } from "./IntroBeat";
import { PREDICTION_INTRO_BEATS } from "./predictionIntroCopy";
import { ScoringExampleDiagram } from "./ScoringExampleDiagram";
import { buildScoringExampleWindow, pickFallbackTeam } from "./scoringExampleWindow";
import { AwardPickerStage } from "./AwardPickerStage";
import { ReviewStage } from "./ReviewStage";
import { savePrediction } from "./usePrediction";
import { validateDraft, type AwardPicks } from "./predictionTypes";
import { AutoAdvance } from "../signup/AutoAdvance";
import { BounceCheck } from "../signup/BounceCheck";
import { sharpVariants } from "../signup/transitions";
import { AWARDS, type AwardId } from "@/data/awards";
import { writeErrorMessage } from "@/lib/withTimeout";

// The scoring-example beat is the only one with a visual.
const SCORING_EXAMPLE_BEAT_INDEX = 1;

/**
 * intro → table → award×8 → review → done.
 *
 * The parent's flow is three stages, because a table is its entire
 * prediction. irishtable predicts a table *and* eight other things, so the
 * award stages sit between the ranker and the confirmation, and a review
 * stage exists to look at all 28 picks before any of them are written.
 *
 * Stage is a discriminated position rather than a string union with eight
 * near-identical members: `awardIndex` indexes AWARDS directly, which is what
 * lets the review stage's per-row "edit" jump straight back to one award.
 */
type Stage =
  | { kind: "intro"; beat: number }
  | { kind: "table" }
  | { kind: "award"; awardIndex: number }
  | { kind: "review" }
  | { kind: "done" };

export interface PredictionSequenceProps {
  uid: string;
  /**
   * "create" walks the whole thing from the intro beats. "edit" opens
   * straight on the review with everything seeded — the picks already exist,
   * so the explanation and the forced march through eight pickers are exactly
   * what someone changing one award does not want. Every stage is still
   * reachable from review's own per-row edit.
   */
  mode?: "create" | "edit";
  initialTable?: string[];
  initialAwards?: AwardPicks;
  /**
   * Seeds the scoring-example diagram. The quiz's "what team do you support?"
   * answer can be "other" or "none", neither of which is a club, so the
   * caller passes whatever it has and this falls back to a uid-hashed club.
   */
  favouriteClubId?: string;
  onDone: () => void;
}

/**
 * The one prediction UI.
 *
 * /predictions renders it in "create" mode as a full-viewport sequence;
 * ProfilePage renders the same component in "edit" mode inside a dialog. The
 * parent has two separate implementations of its ranker's host — a page and a
 * dialog — which is how its two paths drifted; this has one.
 */
export function PredictionSequence({
  uid,
  mode = "create",
  initialTable,
  initialAwards,
  favouriteClubId,
  onDone,
}: PredictionSequenceProps) {
  const [stage, setStage] = useState<Stage>(() =>
    mode === "edit" ? { kind: "review" } : { kind: "intro", beat: 0 }
  );
  const [table, setTable] = useState<string[]>(initialTable ?? []);
  const [awards, setAwards] = useState<AwardPicks>(initialAwards ?? {});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set when a stage was reached from the review's per-row "edit" rather than
  // by walking forward. Confirming that one stage then returns to review
  // instead of marching through the eight awards again. In edit mode every
  // stage is reached that way, since review is where the flow starts.
  const [cameFromReview, setCameFromReview] = useState(false);

  const exampleTeamId =
    favouriteClubId && TEAMS.some((t) => t.id === favouriteClubId)
      ? favouriteClubId
      : pickFallbackTeam([...TEAMS], uid).id;
  const scoringExample = buildScoringExampleWindow([...TEAMS], exampleTeamId);

  function advanceBeat() {
    setStage((s) => {
      if (s.kind !== "intro") return s;
      return s.beat + 1 >= PREDICTION_INTRO_BEATS.length
        ? { kind: "table" }
        : { kind: "intro", beat: s.beat + 1 };
    });
  }

  function handleTableSubmit(order: string[]) {
    setTable(order);
    setStage(cameFromReview ? { kind: "review" } : { kind: "award", awardIndex: 0 });
    setCameFromReview(false);
  }

  function handleAwardPick(awardId: AwardId, candidateId: string, awardIndex: number) {
    setAwards((a) => ({ ...a, [awardId]: candidateId }));
    if (cameFromReview) {
      setCameFromReview(false);
      setStage({ kind: "review" });
      return;
    }
    setStage(
      awardIndex + 1 >= AWARDS.length
        ? { kind: "review" }
        : { kind: "award", awardIndex: awardIndex + 1 }
    );
  }

  function goBack() {
    // In edit mode every non-review stage was entered from review, so back is
    // "give up on this change" rather than a step in a sequence.
    if (mode === "edit") {
      setCameFromReview(false);
      setStage({ kind: "review" });
      return;
    }
    setStage((s) => {
      if (s.kind === "table") return { kind: "intro", beat: PREDICTION_INTRO_BEATS.length - 1 };
      if (s.kind === "award") {
        return s.awardIndex === 0 ? { kind: "table" } : { kind: "award", awardIndex: s.awardIndex - 1 };
      }
      if (s.kind === "review") return { kind: "award", awardIndex: AWARDS.length - 1 };
      if (s.kind === "intro" && s.beat > 0) return { kind: "intro", beat: s.beat - 1 };
      return s;
    });
  }

  async function handleSubmit() {
    const draft = { table, awards };
    const validation = validateDraft(draft);
    if (!validation.ok) {
      setError(validation.reason);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await savePrediction(uid, draft);
      setStage({ kind: "done" });
    } catch (err) {
      console.error("Failed to submit prediction", err);
      setError(writeErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  // Progress across the whole run: the intro beats, the table, the awards,
  // the review. `done` is past the end and shows a full bar. Edit mode has no
  // run to be partway through, so it shows no bar at all.
  const totalStages = PREDICTION_INTRO_BEATS.length + 1 + AWARDS.length + 1;
  const stageIndex =
    stage.kind === "intro"
      ? stage.beat
      : stage.kind === "table"
        ? PREDICTION_INTRO_BEATS.length
        : stage.kind === "award"
          ? PREDICTION_INTRO_BEATS.length + 1 + stage.awardIndex
          : totalStages - 1;

  const showProgress = mode === "create";
  const showBack =
    stage.kind !== "done" &&
    (mode === "edit" ? stage.kind !== "review" : !(stage.kind === "intro" && stage.beat === 0));
  const stageKey =
    stage.kind === "intro"
      ? `intro-${stage.beat}`
      : stage.kind === "award"
        ? `award-${stage.awardIndex}`
        : stage.kind;

  return (
    <>
      {showProgress && (
        <div
          aria-hidden
          className="absolute top-5 left-1/2 h-1 w-64 -translate-x-1/2 overflow-hidden rounded-full bg-color_text/10"
        >
          <div
            className="h-full rounded-full bg-color_text transition-[width] duration-500 ease-[var(--ease-cotton)]"
            style={{ width: `${((stageIndex + 1) / totalStages) * 100}%` }}
          />
        </div>
      )}
      {showBack && (
        <button
          type="button"
          onClick={goBack}
          aria-label="Back"
          className="absolute top-2 left-2 z-10 flex cursor-pointer items-center justify-center rounded-full p-2 text-color_text transition-colors duration-150 ease-[var(--ease-cotton)] hover:bg-color_text hover:text-background sm:top-3 sm:left-4"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={stageKey}
          variants={sharpVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          // `max-h-full` is load-bearing, not belt-and-braces. Both hosts
          // centre this with `items-center` on a ROW-direction flex, which
          // gives a flex item `height: auto` — so without an explicit bound
          // the 20-slot ranker sizes to its content (1034px measured) inside
          // a 620px box and the instruction line and the Reset/Continue
          // footer are simply clipped off. `flex-1` only does the work in the
          // profile dialog, whose wrapper is a column.
          className="no-scrollbar flex max-h-full min-h-0 w-full flex-1 flex-col items-center justify-center overflow-y-auto"
        >
          {stage.kind === "intro" && (
            <IntroBeat
              text={PREDICTION_INTRO_BEATS[stage.beat].text}
              boldTerms={PREDICTION_INTRO_BEATS[stage.beat].boldTerms}
              visual={
                stage.beat === SCORING_EXAMPLE_BEAT_INDEX ? (
                  <ScoringExampleDiagram
                    teams={scoringExample.teams}
                    centerIndex={scoringExample.centerIndex}
                  />
                ) : undefined
              }
              onContinue={advanceBeat}
            />
          )}

          {stage.kind === "table" && (
            <div className="flex h-full min-h-0 w-full max-w-5xl flex-col">
              <TeamRanker
                teams={[...TEAMS]}
                initialOrder={table.length === TEAMS.length ? table : undefined}
                submitLabel={mode === "edit" ? "Done" : "Continue"}
                onSubmit={handleTableSubmit}
              />
            </div>
          )}

          {stage.kind === "award" && (
            <AwardPickerStage
              award={AWARDS[stage.awardIndex]}
              index={stage.awardIndex + 1}
              total={AWARDS.length}
              value={awards[AWARDS[stage.awardIndex].id] ?? null}
              onPick={(candidateId) =>
                handleAwardPick(AWARDS[stage.awardIndex].id, candidateId, stage.awardIndex)
              }
            />
          )}

          {stage.kind === "review" && (
            <ReviewStage
              table={table}
              awards={awards}
              onEditTable={() => {
                setCameFromReview(true);
                setStage({ kind: "table" });
              }}
              onEditAward={(awardId) => {
                const awardIndex = AWARDS.findIndex((a) => a.id === awardId);
                if (awardIndex === -1) return;
                setCameFromReview(true);
                setStage({ kind: "award", awardIndex });
              }}
              onSubmit={handleSubmit}
              submitting={submitting}
              error={error}
            />
          )}

          {stage.kind === "done" && (
            <AutoAdvance delayMs={2000} onDone={onDone}>
              <BounceCheck
                text={mode === "edit" ? "Prediction updated." : "Your prediction is in."}
              />
            </AutoAdvance>
          )}
        </motion.div>
      </AnimatePresence>
    </>
  );
}
