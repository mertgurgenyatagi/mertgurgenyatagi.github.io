// src/forum/ReplyRow.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import type { ComponentProps } from "react";
import { ReplyRow } from "./ReplyRow";
import { PostWithId } from "./postTypes";

const players = [
  { uid: "uid1", displayName: "Mert", photoURL: "", createdAt: 1 },
  { uid: "uid2", displayName: "Ada", photoURL: "", createdAt: 1 },
];

function makePost(overrides: Partial<PostWithId> = {}): PostWithId {
  return {
    id: "reply1",
    uid: "uid1",
    text: "cevap metni",
    imageURL: null,
    parentId: "root1",
    createdAt: 1,
    editedAt: null,
    mentionedUids: [],
    quotedPostId: null,
    quotedAuthorUid: null,
    quotedText: null,
    likedByUids: [],
    ...overrides,
  };
}

function renderRow(overrides: Partial<ComponentProps<typeof ReplyRow>> = {}) {
  return render(
    <ReplyRow
      reply={makePost()}
      players={players}
      playersByUid={new Map(players.map((p) => [p.uid, p]))}
      posts={[makePost()]}
      uid="uid1"
      liked={false}
      likeCount={0}
      onToggleLike={vi.fn()}
      onSelectParticipant={vi.fn()}
      {...overrides}
    />
  );
}

describe("ReplyRow", () => {
  it("shows the author name and reply text", () => {
    renderRow();
    expect(screen.getByText("Mert")).toBeInTheDocument();
    expect(screen.getByText("cevap metni")).toBeInTheDocument();
  });

  it("does not show quote/edit/delete affordances when those callbacks are omitted", () => {
    renderRow();
    expect(screen.queryByLabelText("Quote")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Edit")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Delete")).not.toBeInTheDocument();
  });

  it("shows edit/delete only for your own reply, and only when the callbacks are provided", () => {
    renderRow({ reply: makePost({ uid: "uid2" }), onSaveEdit: vi.fn(), onDelete: vi.fn() });
    expect(screen.queryByLabelText("Edit")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Delete")).not.toBeInTheDocument();
  });

  it("calls onQuote with the reply when the quote button is clicked", () => {
    const onQuote = vi.fn();
    renderRow({ onQuote });
    fireEvent.click(screen.getByLabelText("Quote"));
    expect(onQuote).toHaveBeenCalledWith(expect.objectContaining({ id: "reply1" }));
  });

  it("enters edit mode, saves trimmed text, and calls onSaveEdit", () => {
    const onSaveEdit = vi.fn();
    renderRow({ onSaveEdit });
    fireEvent.click(screen.getByLabelText("Edit"));
    const textarea = screen.getByDisplayValue("cevap metni");
    fireEvent.change(textarea, { target: { value: "  edited text  " } });
    fireEvent.click(screen.getByText("Kaydet"));
    expect(onSaveEdit).toHaveBeenCalledWith("reply1", "edited text");
  });

  it("calls onDelete with the reply id", () => {
    const onDelete = vi.fn();
    renderRow({ onDelete });
    fireEvent.click(screen.getByLabelText("Delete"));
    expect(onDelete).toHaveBeenCalledWith("reply1");
  });

  it("shows a quote chip tinted for an existing target and clickable via onJumpToQuote", () => {
    const onJumpToQuote = vi.fn();
    const quoted = makePost({ id: "original1", uid: "uid2", text: "orijinal" });
    renderRow({
      reply: makePost({ quotedPostId: "original1", quotedAuthorUid: "uid2", quotedText: "orijinal metin" }),
      posts: [quoted, makePost()],
      onJumpToQuote,
    });
    fireEvent.click(screen.getByText(/orijinal metin/));
    expect(onJumpToQuote).toHaveBeenCalledWith("original1");
  });

  it("shows a quote chip as gray and non-clickable when the quoted post no longer exists", () => {
    const onJumpToQuote = vi.fn();
    renderRow({
      reply: makePost({ quotedPostId: "gone1", quotedAuthorUid: "uid2", quotedText: "deleted text" }),
      posts: [makePost()],
      onJumpToQuote,
    });
    fireEvent.click(screen.getByText(/deleted text/));
    expect(onJumpToQuote).not.toHaveBeenCalled();
  });

  it("calls onToggleLike with the reply id", () => {
    const onToggleLike = vi.fn();
    renderRow({ onToggleLike });
    fireEvent.click(screen.getByLabelText("Like"));
    expect(onToggleLike).toHaveBeenCalledWith("reply1");
  });

  it("calls onSelectParticipant with the reply author's uid", () => {
    const onSelectParticipant = vi.fn();
    renderRow({ onSelectParticipant });
    fireEvent.click(screen.getByText("Mert"));
    expect(onSelectParticipant).toHaveBeenCalledWith("uid1");
  });

  it("disables the like button and does not call onToggleLike when logged out", () => {
    const onToggleLike = vi.fn();
    renderRow({ uid: null, onToggleLike });
    const likeButton = screen.getByLabelText("Sign in to like");
    expect(likeButton).toBeDisabled();
    fireEvent.click(likeButton);
    expect(onToggleLike).not.toHaveBeenCalled();
  });

  it("disables the like button in compact mode too when logged out", () => {
    const onToggleLike = vi.fn();
    renderRow({ uid: null, onToggleLike, compact: true });
    const likeButton = screen.getByLabelText("Sign in to like");
    expect(likeButton).toBeDisabled();
    fireEvent.click(likeButton);
    expect(onToggleLike).not.toHaveBeenCalled();
  });
});
