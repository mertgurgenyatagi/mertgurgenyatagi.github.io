import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { useImagePreload } from "./useImagePreload";

describe("useImagePreload", () => {
  const originalImage = window.Image;

  afterEach(() => {
    window.Image = originalImage;
  });

  it("returns true immediately for an empty url list", () => {
    const { result } = renderHook(() => useImagePreload([]));
    expect(result.current).toBe(true);
  });

  it("returns false until every image has loaded, then true", async () => {
    const resolvers: (() => void)[] = [];
    class ControlledImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        resolvers.push(() => this.onload?.());
      }
    }
    window.Image = ControlledImage as unknown as typeof window.Image;

    const { result } = renderHook(() => useImagePreload(["a.png", "b.png"]));
    await waitFor(() => expect(resolvers).toHaveLength(2));
    expect(result.current).toBe(false);

    resolvers.forEach((resolve) => resolve());
    await waitFor(() => expect(result.current).toBe(true));
  });

  it("treats a failed image as settled rather than hanging forever", async () => {
    class FailingImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onerror?.());
      }
    }
    window.Image = FailingImage as unknown as typeof window.Image;

    const { result } = renderHook(() => useImagePreload(["broken.png"]));
    await waitFor(() => expect(result.current).toBe(true));
  });

  it("re-preloads when the url list changes", async () => {
    class TrackingImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    window.Image = TrackingImage as unknown as typeof window.Image;

    const { result, rerender } = renderHook(({ urls }) => useImagePreload(urls), {
      initialProps: { urls: ["a.png"] },
    });
    await waitFor(() => expect(result.current).toBe(true));

    // A new, larger url list still settles back to ready once its own
    // images resolve — same "every image on this page" contract every
    // consuming page/popup relies on.
    rerender({ urls: ["a.png", "b.png"] });
    await waitFor(() => expect(result.current).toBe(true));
  });
});
