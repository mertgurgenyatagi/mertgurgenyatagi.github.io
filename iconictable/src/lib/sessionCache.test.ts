// src/lib/sessionCache.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getCached,
  setCached,
  deleteCached,
  clearSessionCache,
  clearInMemoryCacheForTest,
} from "./sessionCache";

describe("sessionCache", () => {
  beforeEach(() => {
    clearSessionCache();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns undefined for a key that was never cached", () => {
    expect(getCached("nope")).toBeUndefined();
  });

  it("returns the value immediately after setCached, from memory", () => {
    setCached("key", { a: 1 });
    expect(getCached("key")).toEqual({ a: 1 });
  });

  it("falls back to the persisted copy when the in-memory layer is empty (a fresh tab/reload)", () => {
    setCached("key", { a: 1 });
    clearInMemoryCacheForTest();
    expect(getCached("key")).toEqual({ a: 1 });
  });

  it("does not fall back to a persisted entry older than the TTL", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    setCached("key", { a: 1 });
    clearInMemoryCacheForTest();
    vi.setSystemTime(6 * 60 * 1000);
    expect(getCached("key")).toBeUndefined();
  });

  it("still returns a persisted entry within the TTL", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    setCached("key", { a: 1 });
    clearInMemoryCacheForTest();
    vi.setSystemTime(4 * 60 * 1000);
    expect(getCached("key")).toEqual({ a: 1 });
  });

  it("deleteCached removes both the memory and the persisted layer", () => {
    setCached("key", { a: 1 });
    deleteCached("key");
    clearInMemoryCacheForTest();
    expect(getCached("key")).toBeUndefined();
  });

  it("clearSessionCache wipes both layers", () => {
    setCached("key", { a: 1 });
    clearSessionCache();
    expect(getCached("key")).toBeUndefined();
  });

  it("keeps memory-only behavior working if localStorage.setItem throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    expect(() => setCached("key", { a: 1 })).not.toThrow();
    expect(getCached("key")).toEqual({ a: 1 });
  });

  it("treats a localStorage read failure as a cache miss rather than throwing", () => {
    setCached("key", { a: 1 });
    clearInMemoryCacheForTest();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => getCached("key")).not.toThrow();
    expect(getCached("key")).toBeUndefined();
  });
});
