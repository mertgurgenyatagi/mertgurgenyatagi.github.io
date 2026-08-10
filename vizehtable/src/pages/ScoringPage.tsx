import { Frame, FrameBody, FrameHeader, FrameTitle } from "@/components/ui/frame";
import {
  BONUS_RULES,
  CUP_RULES,
  EXACT_POSITION_POINTS,
  INDIVIDUAL_RULES,
  MAX_SCORE,
  OFF_BY_ONE_POINTS,
  TABLE_RULES,
  tablePointsFor,
  type ScoringRule,
} from "@/data/scoring";
import { CLUB_COUNT } from "@/data/clubs";
import { cn } from "@/lib/utils";

/**
 * The rulebook.
 *
 * Every number on this page is read from src/data/scoring.ts rather than
 * typed into the copy, so the page and the rules cannot drift apart. If a
 * point value changes, this page changes with it and so does the prediction
 * flow.
 *
 * The parent has no equivalent page — its scoring is one sentence, explained
 * inside the prediction flow's intro beats. This is built in the cloned
 * idiom rather than a new one: a `Frame` per rule group, banded navy headers,
 * mono meta labels, and the page's own scroll container inside the fixed
 * viewport shell.
 */
export function ScoringPage() {
  return (
    <div className="no-scrollbar mx-auto flex h-full w-full max-w-[1100px] min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4 sm:p-6">
      <header className="flex shrink-0 flex-col gap-3">
        <span className="type-label text-accent uppercase">
          HOW IT WORKS
        </span>
        <h1 className="type-display text-4xl sm:text-5xl font-semibold tracking-wide text-color_text uppercase">
          SCORING
        </h1>
        <p className="max-w-2xl text-lg text-color_textsecondary">
          The table is what matters. Get the order right and you'll win; the cups and the
          individual awards are there to separate people who are level. A flawless entry is
          worth <span className="font-display font-bold text-color_text tnum">{MAX_SCORE}</span>{" "}
          points, and nobody is going to get one.
        </p>
      </header>

      <RuleGroup
        title="THE TABLE"
        blurb={`Each of your ${CLUB_COUNT} placements is compared against where the club actually finishes.`}
        rules={TABLE_RULES}
      />

      <PositionExample />

      <RuleGroup
        title="BONUSES"
        blurb="Two things are worth calling specifically."
        rules={BONUS_RULES}
      />

      <RuleGroup
        title="THE CUPS"
        blurb="One pick each. Only Premier League clubs are listed — if a club from outside the league wins, nobody scores it."
        rules={CUP_RULES}
      />

      <RuleGroup
        title="INDIVIDUAL AWARDS"
        blurb="Six picks, split into two tiers by how hard they are to call."
        rules={INDIVIDUAL_RULES}
      />
    </div>
  );
}

function RuleGroup({
  title,
  blurb,
  rules,
}: {
  title: string;
  blurb: string;
  rules: readonly ScoringRule[];
}) {
  return (
    <Frame className="shrink-0 animate-cotton-rise">
      <FrameHeader tone="navy">
        <FrameTitle className="type-display text-base text-color_text sm:text-lg uppercase">{title}</FrameTitle>
      </FrameHeader>
      <FrameBody className="gap-0 px-4 py-2 sm:px-5">
        <p className="max-w-2xl py-2 text-sm text-color_textsecondary">{blurb}</p>
        <ul className="flex flex-col divide-y divide-color_border1/50">
          {rules.map((rule) => (
            <li key={rule.label} className="flex items-center gap-4 py-3">
              {/* A rule worth nothing shouldn't wear the same colour as one
                  worth points — the accent on "0" reads as a reward. */}
              <span
                className={cn(
                  "w-12 shrink-0 text-right font-display text-xl font-bold tnum",
                  rule.points === "0" ? "text-color_textsecondary/50" : "text-color_gold"
                )}
              >
                {rule.points}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.95rem] text-color_text">{rule.label}</span>
                {rule.note && (
                  <span className="mt-0.5 block text-sm text-color_textsecondary">{rule.note}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </FrameBody>
    </Frame>
  );
}

/**
 * A worked example, because "within one place" is the rule people misread.
 * Positions are illustrative; the points come from the real function, so this
 * cannot show a number the scorer wouldn't award.
 */
function PositionExample() {
  const predicted = 5;
  const outcomes = [3, 4, 5, 6, 7];

  return (
    <Frame className="shrink-0 animate-cotton-rise">
      <FrameHeader tone="navy">
        <FrameTitle className="text-base text-color_text sm:text-lg">A worked example</FrameTitle>
      </FrameHeader>
      <FrameBody className="px-4 py-3 sm:px-5">
        <p className="max-w-2xl pb-3 text-sm text-color_textsecondary">
          Say you put a club <span className="text-color_text">{predicted}th</span>. Here's what
          you get depending on where it actually finishes.
        </p>
        <div className="no-scrollbar -mx-1 overflow-x-auto px-1">
          <div className="flex min-w-max gap-2">
            {outcomes.map((actual) => {
              const points = tablePointsFor(predicted, actual);
              return (
                <div
                  key={actual}
                  className={cn(
                    "flex min-w-[5.5rem] flex-col items-center gap-1 rounded-xl border px-4 py-4",
                    points === EXACT_POSITION_POINTS
                      ? "border-color_gold bg-color_gold/[0.12]"
                      : points === OFF_BY_ONE_POINTS
                        ? "border-color_gold/40 bg-color_gold/[0.05]"
                        : "border-color_border1 bg-foreground/[0.02]"
                  )}
                >
                  <span className="font-mono text-[0.58rem] tracking-[0.18em] text-color_textsecondary uppercase">
                    Finishes
                  </span>
                  <span className="font-display text-2xl font-semibold text-color_text tnum">
                    {actual}
                  </span>
                  <span
                    className={cn(
                      "mt-1 font-display text-lg font-bold tnum",
                      points > 0 ? "text-color_gold" : "text-color_textsecondary/50"
                    )}
                  >
                    {points} pts
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </FrameBody>
    </Frame>
  );
}
