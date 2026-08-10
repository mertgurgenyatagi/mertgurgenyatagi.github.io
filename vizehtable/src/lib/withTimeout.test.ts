import { describe, expect, it, vi } from "vitest";
import { TimeoutError, withTimeout, writeErrorMessage } from "./withTimeout";

/**
 * These pin the behaviour behind a real bug: a Firestore write that never
 * resolved left the UI on "Saving" forever, with nothing on screen and
 * nothing in the console.
 */
describe("withTimeout", () => {
  it("passes a value straight through when the promise settles in time", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 1000, "op")).resolves.toBe("ok");
  });

  it("passes the original rejection through untouched", async () => {
    const original = Object.assign(new Error("denied"), { code: "permission-denied" });
    await expect(withTimeout(Promise.reject(original), 1000, "op")).rejects.toBe(original);
  });

  it("rejects with a TimeoutError when the promise never settles", async () => {
    vi.useFakeTimers();
    const never = new Promise(() => {});
    const guarded = withTimeout(never, 5000, "Saving your profile");
    const assertion = expect(guarded).rejects.toBeInstanceOf(TimeoutError);
    await vi.advanceTimersByTimeAsync(5001);
    await assertion;
    vi.useRealTimers();
  });

  it("names the operation and the wait in the timeout message", async () => {
    vi.useFakeTimers();
    const guarded = withTimeout(new Promise(() => {}), 12_000, "Saving your profile");
    const assertion = expect(guarded).rejects.toThrow(/Saving your profile did not respond within 12s/);
    await vi.advanceTimersByTimeAsync(12_001);
    await assertion;
    vi.useRealTimers();
  });

  it("clears its timer once the promise settles, so it can't fire late", async () => {
    vi.useFakeTimers();
    const clearSpy = vi.spyOn(globalThis, "clearTimeout");
    await withTimeout(Promise.resolve(1), 5000, "op");
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
    vi.useRealTimers();
  });
});

describe("writeErrorMessage", () => {
  it("tells the user a hang is a connectivity problem, not their mistake", () => {
    expect(writeErrorMessage(new TimeoutError("Saving", 12_000))).toMatch(/isn't responding/i);
  });

  it("distinguishes the Firestore codes that mean different things", () => {
    expect(writeErrorMessage({ code: "permission-denied" })).toMatch(/refused/i);
    expect(writeErrorMessage({ code: "unavailable" })).toMatch(/can't reach/i);
    expect(writeErrorMessage({ code: "unauthenticated" })).toMatch(/sign in again/i);
  });

  it("surfaces an unrecognised code rather than hiding it", () => {
    // The generic "something went wrong" is exactly what made the original
    // bug unreportable — an unknown code must still reach the screen.
    expect(writeErrorMessage({ code: "aborted" })).toContain("aborted");
  });

  it("still says something useful when there's no code at all", () => {
    expect(writeErrorMessage(new Error("boom"))).toMatch(/couldn't save/i);
  });
});
