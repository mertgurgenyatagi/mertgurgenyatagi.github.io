import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect } from "vitest";
import { IntroBeat } from "./IntroBeat";
import { PREDICTION_INTRO_BEATS } from "./predictionIntroCopy";
import { EXACT_POSITION_POINTS, OFF_BY_ONE_POINTS } from "@/data/scoring";
import { CLUB_COUNT } from "@/data/clubs";

describe("IntroBeat", () => {
  it("renders the full text and calls onContinue when Continue is clicked", () => {
    const onContinue = vi.fn();
    render(<IntroBeat text="One sentence." onContinue={onContinue} />);
    expect(screen.getByText("One sentence.")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Continue"));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("bolds the given terms without altering the rendered text", () => {
    const fullText = "Exact is 6 points, off by one is 4.";
    render(<IntroBeat text={fullText} boldTerms={["6", "4"]} onContinue={vi.fn()} />);
    expect(
      screen.getByText((_, el) => el?.tagName === "P" && el.textContent === fullText)
    ).toBeInTheDocument();
    expect(screen.getByText("6").tagName).toBe("STRONG");
    expect(screen.getByText("4").tagName).toBe("STRONG");
  });

  it("renders an optional visual between the text and the button", () => {
    render(<IntroBeat text="One sentence." visual={<div>diagram</div>} onContinue={vi.fn()} />);
    expect(screen.getByText("diagram")).toBeInTheDocument();
  });
});

// The standing rule for this project is that no scoring number is ever
// restated in copy — every one is imported from src/data/scoring.ts. The
// parent's equivalent file hard-codes its numbers and drifts the moment a
// rule changes; this test is what stops that happening here.
describe("PREDICTION_INTRO_BEATS", () => {
  it("carries the real scoring numbers, not literals", () => {
    const joined = PREDICTION_INTRO_BEATS.map((b) => b.text).join(" ");
    expect(joined).toContain(String(EXACT_POSITION_POINTS));
    expect(joined).toContain(String(OFF_BY_ONE_POINTS));
    expect(joined).toContain(String(CLUB_COUNT));
  });

  it("bolds exactly the scoring numbers on the scoring beat", () => {
    const scoringBeat = PREDICTION_INTRO_BEATS[1];
    expect(scoringBeat.boldTerms).toEqual([
      String(EXACT_POSITION_POINTS),
      String(OFF_BY_ONE_POINTS),
    ]);
  });
});
