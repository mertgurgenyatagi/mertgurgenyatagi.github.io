import { vi, describe, it, expect, beforeEach } from "vitest";

const mockUpdateDoc = vi.fn();
const mockDoc = vi.fn((_db: unknown, ...path: string[]) => ({ path }));

vi.mock("firebase/firestore", () => ({
  doc: (...args: unknown[]) => mockDoc(...(args as [unknown, ...string[]])),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
}));

vi.mock("../firebase", () => ({ db: {} }));

import { deleteMessage } from "./deleteMessage";

describe("deleteMessage", () => {
  beforeEach(() => {
    mockUpdateDoc.mockReset();
    mockDoc.mockClear();
  });

  it("soft-deletes by setting only the `deleted` flag", async () => {
    mockUpdateDoc.mockResolvedValue(undefined);
    await deleteMessage("msg1");
    expect(mockDoc).toHaveBeenCalledWith({}, "messages", "msg1");
    const [, update] = mockUpdateDoc.mock.calls[0];
    expect(update).toEqual({ deleted: true });
  });

  it("propagates a write rejection to the caller", async () => {
    mockUpdateDoc.mockRejectedValue(new Error("permission-denied"));
    await expect(deleteMessage("msg1")).rejects.toThrow("permission-denied");
  });
});
