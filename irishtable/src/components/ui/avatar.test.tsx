import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Avatar, AvatarImage, AvatarFallback } from "./avatar";

// AvatarImage renders with alt="" (decorative, matching every real call
// site) — an empty alt means no implicit ARIA "img" role, so these query by
// data-slot instead of getByRole("img").
describe("AvatarImage", () => {
  // Deliberately carries no entrance animation: the sitewide useImagePreload
  // gate means a mounted avatar is already decoded, and a running animation
  // per avatar kept ~50 elements composited in scrolling lists, which is what
  // made the pictures wobble on scroll (2026-08-06).
  it("renders the photo with no per-image entrance animation", async () => {
    const { container } = render(
      <Avatar>
        <AvatarImage src="/photo.png" alt="" />
        <AvatarFallback>MG</AvatarFallback>
      </Avatar>
    );
    await waitFor(() => expect(container.querySelector('[data-slot="avatar-image"]')).toBeInTheDocument());
    expect(container.querySelector('[data-slot="avatar-image"]')).not.toHaveClass("animate-cotton-fade");
  });

  it("shows the fallback, not a broken/empty image, before the photo has loaded", () => {
    const { container } = render(
      <Avatar>
        <AvatarImage src="/photo.png" alt="" />
        <AvatarFallback>MG</AvatarFallback>
      </Avatar>
    );
    expect(screen.getByText("MG")).toBeInTheDocument();
    expect(container.querySelector('[data-slot="avatar-image"]')).not.toBeInTheDocument();
  });
});
