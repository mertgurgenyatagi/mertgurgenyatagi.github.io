import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect } from "vitest";
import { AwardPickerStage } from "./AwardPickerStage";
import { AWARDS, getAward } from "@/data/awards";

const cupAward = getAward("faCup")!;
const playerAward = getAward("playerOfSeason")!;

describe("AwardPickerStage", () => {
  it("shows the award's name, blurb and its position in the run", () => {
    render(<AwardPickerStage award={cupAward} index={1} total={AWARDS.length} onPick={vi.fn()} />);
    expect(screen.getByText(cupAward.label)).toBeInTheDocument();
    expect(screen.getByText(cupAward.blurb)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`Award 1 of ${AWARDS.length}`, "i"))).toBeInTheDocument();
  });

  it("states the award's own point value, from the rulebook", () => {
    render(<AwardPickerStage award={cupAward} index={1} total={AWARDS.length} onPick={vi.fn()} />);
    expect(screen.getByText(new RegExp(`${cupAward.points} (point|points)`, "i"))).toBeInTheDocument();
  });

  it("keeps continue disabled until something is selected, then reports the pick", () => {
    const onPick = vi.fn();
    render(<AwardPickerStage award={cupAward} index={1} total={AWARDS.length} onPick={onPick} />);
    const confirm = screen.getByRole("button", { name: /continue/i });
    expect(confirm).toBeDisabled();

    fireEvent.click(screen.getByTitle("Arsenal"));
    expect(confirm).not.toBeDisabled();
    fireEvent.click(confirm);
    expect(onPick).toHaveBeenCalledWith("arsenal");
  });

  it("seeds the selection from `value`, so revisiting a stage keeps the answer", () => {
    render(
      <AwardPickerStage award={cupAward} index={1} total={AWARDS.length} value="chelsea" onPick={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: /continue/i })).not.toBeDisabled();
  });

  // Clubs are a short list and get a crest grid; players run to hundreds and
  // get a filter box. One layout reads badly for both.
  it("gives a long shortlist a search box and a short one none", () => {
    const { unmount } = render(
      <AwardPickerStage award={cupAward} index={1} total={AWARDS.length} onPick={vi.fn()} />
    );
    expect(screen.queryByLabelText(/^Search /)).not.toBeInTheDocument();
    unmount();

    render(<AwardPickerStage award={playerAward} index={3} total={AWARDS.length} onPick={vi.fn()} />);
    expect(screen.getByLabelText(`Search ${playerAward.searchNoun}`)).toBeInTheDocument();
  });

  it("filters the shortlist as you type, and says so when nothing matches", () => {
    render(<AwardPickerStage award={playerAward} index={3} total={AWARDS.length} onPick={vi.fn()} />);
    const search = screen.getByLabelText(`Search ${playerAward.searchNoun}`);
    const first = playerAward.candidates[0];

    fireEvent.change(search, { target: { value: first.name } });
    expect(screen.getByText(first.name)).toBeInTheDocument();

    fireEvent.change(search, { target: { value: "zzzzzzzz" } });
    expect(screen.getByText(/nothing matches that/i)).toBeInTheDocument();
  });
});
