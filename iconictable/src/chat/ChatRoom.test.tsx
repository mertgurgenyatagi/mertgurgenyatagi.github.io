import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { Player } from "../profile/usePlayers";
import { MessageWithId } from "./useMessages";

const mockDeleteMessage = vi.fn();
const mockFetchRecentMessagesForSearch = vi.fn();

vi.mock("./deleteMessage", () => ({
  deleteMessage: (...args: unknown[]) => mockDeleteMessage(...args),
}));
// filterMessagesByTerm is real (pure logic, cheap to actually exercise) —
// only the network-fetching half is mocked.
vi.mock("./searchMessages", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./searchMessages")>();
  return {
    ...actual,
    fetchRecentMessagesForSearch: (...args: unknown[]) => mockFetchRecentMessagesForSearch(...args),
  };
});
vi.mock("./ChatComposer", () => ({
  ChatComposer: ({
    uid,
    players,
    mentionCandidates,
  }: {
    uid: string;
    players: Player[];
    mentionCandidates?: Player[];
  }) => (
    <div>
      chat-composer:{uid}:{players.length}:mentions:{(mentionCandidates ?? players).map((p) => p.displayName).join(",")}
    </div>
  ),
}));

import { ChatRoom } from "./ChatRoom";
import { SEARCH_WINDOW } from "./searchMessages";

const players: Player[] = [
  { uid: "me", displayName: "Mert", photoURL: "", createdAt: 0 },
  { uid: "uid-ada", displayName: "Ada", photoURL: "", createdAt: 1 },
  { uid: "uid-kuzey", displayName: "Kuzey", photoURL: "", createdAt: 2 },
];

function message(overrides: Partial<MessageWithId>): MessageWithId {
  return { id: "m1", uid: "uid-ada", text: "Merhaba", createdAt: Date.now(), ...overrides };
}

function renderRoom(overrides: Partial<Parameters<typeof ChatRoom>[0]> = {}) {
  return render(
    <ChatRoom
      uid="me"
      players={players}
      messages={[]}
      onLoadOlder={vi.fn()}
      loadingOlder={false}
      hasMoreOlder={false}
      typingUids={[]}
      onSelectParticipant={vi.fn()}
      {...overrides}
    />
  );
}

describe("ChatRoom", () => {
  beforeEach(() => {
    mockDeleteMessage.mockReset();
    mockFetchRecentMessagesForSearch.mockReset();
  });

  it("shows an empty state when there are no messages", () => {
    renderRoom();
    expect(screen.getByText("Nothing said yet.")).toBeInTheDocument();
  });

  it("renders each message with the sender's resolved full name", () => {
    renderRoom({ messages: [message({ uid: "uid-ada", text: "Merhaba" })] });
    expect(screen.getByText("Ada")).toBeInTheDocument();
    expect(screen.getByText("Merhaba")).toBeInTheDocument();
  });

  it("shows 'Deleted' (not the raw uid) when no matching player is found", () => {
    renderRoom({ messages: [message({ uid: "unknown-uid" })], players: [] });
    expect(screen.getByText("Deleted")).toBeInTheDocument();
    expect(screen.queryByText("unknown-uid")).not.toBeInTheDocument();
  });

  it("opens the participant popup when a name is clicked", () => {
    const onSelectParticipant = vi.fn();
    renderRoom({ messages: [message({ uid: "uid-ada" })], onSelectParticipant });
    fireEvent.click(screen.getByText("Ada"));
    expect(onSelectParticipant).toHaveBeenCalledWith("uid-ada");
  });

  it("shows a delete button only on the current user's own messages", () => {
    renderRoom({
      messages: [message({ id: "mine", uid: "me", text: "my message" }), message({ id: "theirs", uid: "uid-ada", text: "their message" })],
    });
    expect(screen.getAllByRole("button", { name: "Delete message" })).toHaveLength(1);
  });

  it("deletes a message on click and surfaces an error if it fails", async () => {
    mockDeleteMessage.mockRejectedValue(new Error("permission-denied"));
    renderRoom({ messages: [message({ id: "mine", uid: "me", text: "sil beni" })] });
    fireEvent.click(screen.getByRole("button", { name: "Delete message" }));
    expect(mockDeleteMessage).toHaveBeenCalledWith("mine");
    expect(await screen.findByRole("alert")).toHaveTextContent("Mesaj silinemedi, tekrar deneyin.");
  });


  it("shows a placeholder instead of the text for a deleted message, with no delete button", () => {
    renderRoom({ messages: [message({ id: "gone", uid: "me", text: "gizli", deleted: true })] });
    expect(screen.getByText("This message was deleted.")).toBeInTheDocument();
    expect(screen.queryByText("gizli")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete message" })).not.toBeInTheDocument();
  });

  it("shows a date divider for the message list", () => {
    renderRoom({ messages: [message({})] });
    expect(screen.getByText("Today")).toBeInTheDocument();
  });

  it("shows a load-older button only when there's more history, and wires it up", () => {
    const onLoadOlder = vi.fn();
    const { rerender } = renderRoom({ messages: [message({})], hasMoreOlder: false, onLoadOlder });
    expect(screen.queryByText("Load older messages")).not.toBeInTheDocument();

    rerender(
      <ChatRoom
        uid="me"
        players={players}
        messages={[message({})]}
        onLoadOlder={onLoadOlder}
        loadingOlder={false}
        hasMoreOlder={true}
        typingUids={[]}
        onSelectParticipant={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText("Load older messages"));
    expect(onLoadOlder).toHaveBeenCalledTimes(1);
  });

  it("shows nothing on the typing line when nobody is typing", () => {
    renderRoom({ messages: [message({})], typingUids: [] });
    expect(screen.queryByText(/typing/)).not.toBeInTheDocument();
  });

  it("names the one person typing", () => {
    renderRoom({ messages: [message({})], typingUids: ["uid-ada"] });
    expect(screen.getByText("Ada is typing…")).toBeInTheDocument();
  });

  it("summarizes three or more typists by count", () => {
    renderRoom({ messages: [message({})], typingUids: ["me", "uid-ada", "uid-kuzey"] });
    expect(screen.getByText("3 people are typing…")).toBeInTheDocument();
  });

  it("passes uid and players through to the composer", () => {
    renderRoom({ messages: [message({})] });
    expect(screen.getByText("chat-composer:me:3:mentions:Mert,Ada,Kuzey")).toBeInTheDocument();
  });

  // Author lookup must resolve from the full directory, never a filtered
  // slice: a uid that resolves to nothing renders with the deleted-account
  // label, which would falsely claim the account was deleted.
  it("resolves a message author from the player directory, not the mention list", () => {
    renderRoom({
      players,
      mentionCandidates: [players[0], players[2]],
      messages: [message({ id: "old", uid: "uid-ada", text: "an old message of mine" })],
    });
    expect(screen.getByText("Ada")).toBeInTheDocument();
    expect(screen.queryByText("Deleted")).not.toBeInTheDocument();
  });


  describe("search", () => {
    it("opens a search input when the search button is clicked, and closes it again", () => {
      renderRoom({ messages: [message({})] });
      fireEvent.click(screen.getByRole("button", { name: "Search chat" }));
      expect(screen.getByPlaceholderText("Search chat…")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Close search" }));
      expect(screen.queryByPlaceholderText("Sohbette ara…")).not.toBeInTheDocument();
    });

    it("searches and renders matching results", async () => {
      mockFetchRecentMessagesForSearch.mockResolvedValue([
        message({ id: "found", uid: "uid-ada", text: "aranan kelime" }),
        message({ id: "other", uid: "uid-ada", text: "listedeki mesaj" }),
      ]);
      renderRoom({ messages: [message({ text: "listedeki mesaj" })] });

      fireEvent.click(screen.getByRole("button", { name: "Search chat" }));
      fireEvent.change(screen.getByPlaceholderText("Search chat…"), { target: { value: "aranan" } });

      await waitFor(() => expect(mockFetchRecentMessagesForSearch).toHaveBeenCalledTimes(1));
      expect(await screen.findByText("aranan kelime")).toBeInTheDocument();
      expect(screen.queryByText("listedeki mesaj")).not.toBeInTheDocument();
    });

    it("shows a no-results message when a search comes back empty", async () => {
      mockFetchRecentMessagesForSearch.mockResolvedValue([]);
      renderRoom({ messages: [] });
      fireEvent.click(screen.getByRole("button", { name: "Search chat" }));
      fireEvent.change(screen.getByPlaceholderText("Search chat…"), { target: { value: "no such thing" } });
      expect(await screen.findByText("No matches.")).toBeInTheDocument();
    });

    // Search is capped at SEARCH_WINDOW messages (scaling-250 design spec §3),
    // so a miss inside a full window genuinely might exist further back. Saying
    // nothing there would quietly imply the message never existed.
    it("says the search only covered recent messages when the window came back full", async () => {
      const full = Array.from({ length: SEARCH_WINDOW }, (_, i) => ({
        id: `m${i}`,
        uid: "u1",
        text: "unrelated",
        createdAt: i,
      }));
      mockFetchRecentMessagesForSearch.mockResolvedValue(full);
      renderRoom({ messages: [] });
      fireEvent.click(screen.getByRole("button", { name: "Search chat" }));
      fireEvent.change(screen.getByPlaceholderText("Search chat…"), {
        target: { value: "no such thing" },
      });
      expect(
        await screen.findByText(`No matches. Search covers the last ${SEARCH_WINDOW} messages.`)
      ).toBeInTheDocument();
    });

    it("does not re-fetch on a second keystroke within the same search session", async () => {
      mockFetchRecentMessagesForSearch.mockResolvedValue([
        message({ id: "found", uid: "uid-ada", text: "aranan kelime" }),
      ]);
      renderRoom({ messages: [] });
      fireEvent.click(screen.getByRole("button", { name: "Search chat" }));

      fireEvent.change(screen.getByPlaceholderText("Search chat…"), { target: { value: "aran" } });
      await waitFor(() => expect(mockFetchRecentMessagesForSearch).toHaveBeenCalledTimes(1));

      fireEvent.change(screen.getByPlaceholderText("Search chat…"), { target: { value: "aranan" } });
      expect(await screen.findByText("aranan kelime")).toBeInTheDocument();
      expect(mockFetchRecentMessagesForSearch).toHaveBeenCalledTimes(1);
    });

    it("fetches again if the search panel is closed and reopened", async () => {
      mockFetchRecentMessagesForSearch.mockResolvedValue([]);
      renderRoom({ messages: [] });

      fireEvent.click(screen.getByRole("button", { name: "Search chat" }));
      fireEvent.change(screen.getByPlaceholderText("Search chat…"), { target: { value: "a" } });
      await waitFor(() => expect(mockFetchRecentMessagesForSearch).toHaveBeenCalledTimes(1));

      fireEvent.click(screen.getByRole("button", { name: "Close search" }));
      fireEvent.click(screen.getByRole("button", { name: "Search chat" }));
      fireEvent.change(screen.getByPlaceholderText("Search chat…"), { target: { value: "b" } });
      await waitFor(() => expect(mockFetchRecentMessagesForSearch).toHaveBeenCalledTimes(2));
    });

    it("fetches the search window once a term is typed", async () => {
      mockFetchRecentMessagesForSearch.mockResolvedValue([]);
      renderRoom({ messages: [] });
      fireEvent.click(screen.getByRole("button", { name: "Search chat" }));
      fireEvent.change(screen.getByPlaceholderText("Search chat…"), { target: { value: "a" } });
      await waitFor(() => expect(mockFetchRecentMessagesForSearch).toHaveBeenCalled());
    });

  });

  it("tints a message that @mentions the current user", () => {
    renderRoom({
      messages: [message({ id: "mention", uid: "uid-ada", text: "@Mert look at this", mentionedUids: ["me"] })],
    });
    expect(screen.getByText("@Mert")).toHaveClass("text-color_accent");
  });

});
