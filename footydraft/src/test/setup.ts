import '@testing-library/jest-dom/vitest'

// jsdom doesn't implement ResizeObserver. `Dotgrid` uses one to measure its
// own rendered box; jsdom's `getBoundingClientRect()` always returns zeros
// anyway (no real layout), so a no-op stub is all a test run needs — it just
// has to exist so `new ResizeObserver(...)` doesn't throw.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
