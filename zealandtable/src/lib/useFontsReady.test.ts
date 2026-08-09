import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { useFontsReady } from "./useFontsReady";

describe("useFontsReady", () => {
  const originalFonts = (document as unknown as { fonts?: unknown }).fonts;

  afterEach(() => {
    if (originalFonts === undefined) {
      delete (document as unknown as { fonts?: unknown }).fonts;
    } else {
      (document as unknown as { fonts?: unknown }).fonts = originalFonts;
    }
  });

  it("returns true immediately when document.fonts doesn't exist", () => {
    delete (document as unknown as { fonts?: unknown }).fonts;
    const { result } = renderHook(() => useFontsReady());
    expect(result.current).toBe(true);
  });

  it("returns true immediately when fonts are already loaded", () => {
    (document as unknown as { fonts?: unknown }).fonts = { status: "loaded", ready: Promise.resolve() };
    const { result } = renderHook(() => useFontsReady());
    expect(result.current).toBe(true);
  });

  it("returns false until the fonts.ready promise resolves, then true", async () => {
    let resolveReady: () => void = () => {};
    const readyPromise = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });
    (document as unknown as { fonts?: unknown }).fonts = { status: "loading", ready: readyPromise };

    const { result } = renderHook(() => useFontsReady());
    expect(result.current).toBe(false);

    resolveReady();
    await waitFor(() => expect(result.current).toBe(true));
  });
});
