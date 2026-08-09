import "@testing-library/jest-dom/vitest";

/**
 * Polyfills, each tied to the exact thing that needs it. Nothing speculative —
 * if a polyfill is here, a test failed without it.
 */

// `motion`'s scroll-triggered reveals observe intersection.
class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
  root = null;
  rootMargin = "";
  thresholds = [];
}
globalThis.IntersectionObserver =
  MockIntersectionObserver as unknown as typeof IntersectionObserver;

// @dnd-kit measures droppable rects on mount.
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

// The reduced-motion check in the stylesheet and in `motion`.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

// The chat transcript scrolls itself to the newest message.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// The photo step previews a picked file before upload.
if (!URL.createObjectURL) {
  URL.createObjectURL = () => "blob:mock";
  URL.revokeObjectURL = () => {};
}

// jsdom never actually fetches image bytes, so a real `new Image()` sits
// forever without firing load/error. Three things depend on that firing:
// useImagePreload's page gate, HeroCarousel's preload-before-render, and
// base-ui's Avatar deciding whether the photo or the fallback renders.
// Without this, every one of them is stuck in its pre-load state in tests.
//
// Supports both the `onload` property and addEventListener — base-ui uses
// the latter, the app's own preload hook uses the former.
class ImageMock {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 1;
  naturalHeight = 1;
  complete = false;
  private listeners = new Map<string, Set<() => void>>();

  addEventListener(type: string, fn: () => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn);
  }

  removeEventListener(type: string, fn: () => void) {
    this.listeners.get(type)?.delete(fn);
  }

  set src(_value: string) {
    queueMicrotask(() => {
      this.complete = true;
      this.onload?.();
      this.listeners.get("load")?.forEach((fn) => fn());
    });
  }
}
window.Image = ImageMock as unknown as typeof window.Image;
