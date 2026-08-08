import { render, screen, fireEvent, within } from "@testing-library/react";
import { vi, describe, it, expect } from "vitest";
import { ReviewStage } from "./ReviewStage";
import { AWARDS, candidateName } from "@/data/awards";
import { CLUBS, CLUB_COUNT } from "@/data/clubs";
import type { AwardPicks } from "./predictionTypes";

const fullTable = CLUBS.map((c) => c.id);

/** A complete set of picks — the first candidate on each shortlist. */
const fullAwards: AwardPicks = Object.fromEntries(
  AWARDS.map((a) => [a.id, a.candidates[0].id])
);

function renderReview(overrides: Partial<React.ComponentProps<typeof ReviewStage>> = {}) {
  return render(
    <ReviewStage
      table={fullTable}
      awards={fullAwards}
      onEditTable={vi.fn()}
      onEditAward={vi.fn()}
      onSubmit={vi.fn()}
      submitting={false}
      error={null}
      {...overrides}
    />
  );
}

describe("ReviewStage", () => {
  // Both cup awards resolve to a club, and every club is also in the table, so
  // these have to be scoped rather than queried off the whole document — a
  // bare getByText("AFC Bournemouth") legitimately matches two nodes here.
  it("lists every club in the table, in the predicted order", () => {
    renderReview();
    const table = within(screen.getByRole("list"));
    for (const club of CLUBS) {
      expect(table.getByText(club.name)).toBeInTheDocument();
    }
    expect(table.getByText(String(CLUB_COUNT))).toBeInTheDocument();
  });

  it("lists all eight awards with the name of each pick", () => {
    renderReview();
    for (const award of AWARDS) {
      const row = screen.getByLabelText(`Edit ${award.label}`).closest("div")!;
      expect(within(row).getByText(award.label)).toBeInTheDocument();
      expect(
        within(row).getByText(candidateName(award.id, fullAwards[award.id]!))
      ).toBeInTheDocument();
    }
  });

  it("shows an em dash for an award that has no pick yet", () => {
    renderReview({ awards: {} });
    expect(screen.getAllByText("—")).toHaveLength(AWARDS.length);
  });

  it("routes the table's edit affordance back to the table stage", () => {
    const onEditTable = vi.fn();
    renderReview({ onEditTable });
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(onEditTable).toHaveBeenCalledTimes(1);
  });

  it("routes each award's edit affordance back to that specific award", () => {
    const onEditAward = vi.fn();
    renderReview({ onEditAward });
    fireEvent.click(screen.getByLabelText(`Edit ${AWARDS[4].label}`));
    expect(onEditAward).toHaveBeenCalledWith(AWARDS[4].id);
  });

  it("submits, and disables the button while the write is in flight", () => {
    const onSubmit = vi.fn();
    const { rerender } = renderReview({ onSubmit });
    fireEvent.click(screen.getByRole("button", { name: "Send it" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);

    rerender(
      <ReviewStage
        table={fullTable}
        awards={fullAwards}
        onEditTable={vi.fn()}
        onEditAward={vi.fn()}
        onSubmit={onSubmit}
        submitting
        error={null}
      />
    );
    expect(screen.getByRole("button", { name: "Sending…" })).toBeDisabled();
  });

  it("surfaces a write error as an alert", () => {
    renderReview({ error: "Couldn’t save that." });
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn’t save that.");
  });
});
