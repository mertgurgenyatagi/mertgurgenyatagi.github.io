import { describe, expect, it } from "vitest";
import { signInErrorMessage } from "./AuthProvider";

/**
 * These cover the failure that actually bit in the wild: a sign-in that took
 * three clicks because two of them failed silently.
 *
 * The rule is that exactly one code is allowed to produce no message — the
 * user deliberately closing the popup. Everything else must say something,
 * because an error the user can't see is indistinguishable from a dead button.
 */
describe("signInErrorMessage", () => {
  it("stays silent only when the user closed the popup themselves", () => {
    expect(signInErrorMessage("auth/popup-closed-by-user")).toBeNull();
  });

  it("explains a provider that isn't switched on", () => {
    expect(signInErrorMessage("auth/operation-not-allowed")).toMatch(/isn't switched on/i);
  });

  it("explains an unauthorised domain", () => {
    expect(signInErrorMessage("auth/unauthorized-domain")).toMatch(/authorised/i);
  });

  it("distinguishes a network failure from a generic one", () => {
    expect(signInErrorMessage("auth/network-request-failed")).toMatch(/connection/i);
  });

  it("falls back to something actionable for an unknown code", () => {
    expect(signInErrorMessage("auth/some-code-that-does-not-exist")).toMatch(/try again/i);
  });

  it("never returns an empty string — silence must be explicit null", () => {
    for (const code of [
      "auth/operation-not-allowed",
      "auth/unauthorized-domain",
      "auth/network-request-failed",
      "auth/internal-error",
      "",
    ]) {
      const message = signInErrorMessage(code);
      expect(message === null || message.length > 0).toBe(true);
    }
  });
});
