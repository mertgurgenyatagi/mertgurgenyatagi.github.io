// src/forum/ThreadCard.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import type { ComponentProps } from "react";
import { ThreadCard } from "./ThreadCard";
import { PostWithId } from "./postTypes";

const players = [
  { uid: "uid1", displayName: "Mert", photoURL: "", createdAt: 1 },
  { uid: "uid2", displayName: "Ada", photoURL: "", createdAt: 1 },
];

function makePost(overrides: Partial<PostWithId> = {}): PostWithId {
  return {
    id: "root1",
    uid: "uid1",
    text: "Konu metni",
    imageURL: null,
    parentId: null,
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

function renderCard(overrides: Partial<ComponentProps<typeof ThreadCard>> = {}) {
  return render(
    <ThreadCard
      post={makePost()}
      replies={[]}
      players={players}
      playersByUid={new Map(players.map((p) => [p.uid, p]))}
      posts={[makePost()]}
      uid="uid1"
      likesByPost={new Map()}
      onToggleLike={vi.fn()}
      onSelectParticipant={vi.fn()}
      onExpand={vi.fn()}
      {...overrides}
    />
  );
}

describe("ThreadCard", () => {
  it("shows the author name and post text", () => {
    renderCard();
    expect(screen.getByText("Mert")).toBeInTheDocument();
    expect(screen.getByText("Konu metni")).toBeInTheDocument();
  });

  it("calls onSelectParticipant with the author's uid when the name is clicked", () => {
    const onSelectParticipant = vi.fn();
    renderCard({ onSelectParticipant });
    fireEvent.click(screen.getByText("Mert"));
    expect(onSelectParticipant).toHaveBeenCalledWith("uid1");
  });

  it("shows an edited marker when the post has been edited", () => {
    renderCard({ post: makePost({ editedAt: 999 }) });
    expect(screen.getByText(/edited/)).toBeInTheDocument();
  });

  it("does not show a delete button when onDelete is omitted", () => {
    renderCard({ onDelete: undefined });
    expect(screen.queryByLabelText("Delete thread")).not.toBeInTheDocument();
  });

  it("calls onDelete with the post id when the delete button is clicked", () => {
    const onDelete = vi.fn();
    renderCard({ onDelete });
    fireEvent.click(screen.getByLabelText("Delete thread"));
    expect(onDelete).toHaveBeenCalledWith("root1");
  });

  it("clamps long text and shows a 'read more' link that calls onExpand", () => {
    const onExpand = vi.fn();
    const longText = "a".repeat(250);
    renderCard({ post: makePost({ text: longText }), onExpand });
    fireEvent.click(screen.getByText("Read more"));
    expect(onExpand).toHaveBeenCalledTimes(1);
  });

  it("does not show a 'read more' link for short text", () => {
    renderCard({ post: makePost({ text: "short text" }) });
    expect(screen.queryByText("Read more")).not.toBeInTheDocument();
  });

  it("shows only the 3 most recent replies, oldest of the three first", () => {
    const replies = [
      makePost({ id: "r1", parentId: "root1", text: "reply one", createdAt: 1 }),
      makePost({ id: "r2", parentId: "root1", text: "reply two", createdAt: 2 }),
      makePost({ id: "r3", parentId: "root1", text: "reply three", createdAt: 3 }),
      makePost({ id: "r4", parentId: "root1", text: "reply four", createdAt: 4 }),
    ];
    renderCard({ replies });
    expect(screen.queryByText("reply one")).not.toBeInTheDocument();
    expect(screen.getByText("reply two")).toBeInTheDocument();
    expect(screen.getByText("reply three")).toBeInTheDocument();
    expect(screen.getByText("reply four")).toBeInTheDocument();
  });

  it("shows an omitted-count banner that calls onExpand when there are more than 3 replies", () => {
    const onExpand = vi.fn();
    const replies = Array.from({ length: 5 }, (_, i) =>
      makePost({ id: `r${i}`, parentId: "root1", text: `reply ${i}`, createdAt: i })
    );
    renderCard({ replies, onExpand });
    fireEvent.click(screen.getByText("+ 2 earlier replies · see all"));
    expect(onExpand).toHaveBeenCalledTimes(1);
  });

  it("the reply-count pill always calls onExpand, even with zero replies", () => {
    const onExpand = vi.fn();
    renderCard({ onExpand });
    fireEvent.click(screen.getByText("0 replies"));
    expect(onExpand).toHaveBeenCalledTimes(1);
  });

  it("shows the like count and calls onToggleLike with the post id", () => {
    const onToggleLike = vi.fn();
    const likesByPost = new Map([["root1", new Set(["uid2"])]]);
    renderCard({ likesByPost, onToggleLike });
    expect(screen.getByText("1")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Like"));
    expect(onToggleLike).toHaveBeenCalledWith("root1");
  });

  it("disables the like button and does not call onToggleLike when logged out", () => {
    const onToggleLike = vi.fn();
    renderCard({ uid: null, onToggleLike });
    const likeButton = screen.getByLabelText("Sign in to like");
    expect(likeButton).toBeDisabled();
    fireEvent.click(likeButton);
    expect(onToggleLike).not.toHaveBeenCalled();
  });

  it("still shows the like count when logged out", () => {
    const likesByPost = new Map([["root1", new Set(["uid2"])]]);
    renderCard({ uid: null, likesByPost });
    expect(screen.getByText("1")).toBeInTheDocument();
  });
});
