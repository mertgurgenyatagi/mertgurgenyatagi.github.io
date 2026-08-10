/**
 * Bound a promise that has no timeout of its own.
 *
 * This exists because of a real failure: `setDoc` resolves only when the
 * server acknowledges the write, and if that acknowledgement never comes the
 * promise simply stays pending — forever, with no error. The UI sat on
 * "Saving" indefinitely and there was nothing on screen or in the console to
 * say why.
 *
 * A pending promise can't be cancelled, so the underlying write may still land
 * later. That's fine and even desirable: the point here is to stop *the
 * interface* from lying about what's happening, not to undo the operation.
 */
export class TimeoutError extends Error {
  readonly code = "app/timeout";
  constructor(label: string, ms: number) {
    super(`${label} did not respond within ${Math.round(ms / 1000)}s`);
    this.name = "TimeoutError";
  }
}

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/** How long any single write may appear to be working before we admit it isn't. */
export const WRITE_TIMEOUT_MS = 12_000;

/**
 * A message that names the actual problem. A generic "something went wrong"
 * is what made the original hang so hard to diagnose — there was nothing to
 * report back.
 */
export function writeErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code ?? "";

  if (code === "app/timeout") {
    return "The server isn't responding. Your connection may be blocking it — try again, or switch network.";
  }
  if (code === "permission-denied") {
    return "That save was refused by the server.";
  }
  if (code === "unavailable" || code === "resource-exhausted") {
    return "Can't reach the server right now. Try again in a moment.";
  }
  if (code === "unauthenticated") {
    return "Your session expired. Sign in again.";
  }
  return code ? `Couldn't save that (${code}). Try again.` : "Couldn't save that. Try again.";
}
