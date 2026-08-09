import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, it, expect } from "vitest";
import { RecentPostsPreview, ForumPreviewFooter } from "./RecentPostsPreview";
import { PostWithId } from "./postTypes";
import { Player } from "../profile/usePlayers";

const players: Player[] = [{ uid: "uid1", displayName: "Ada", photoURL: "", createdAt: 1 }];

function post(overrides: Partial<PostWithId>): PostWithId {
  return {
    id: "p1",
    uid: "uid1",
    text: "Merhaba",
    imageURL: null,
    parentId: null,
    createdAt: 1000,
    editedAt: null,
    mentionedUids: [],
    quotedPostId: null,
    quotedAuthorUid: null,
    quotedText: null,
    likedByUids: [],
    ...overrides,
  };
}

function renderPreview(overrides: Partial<Parameters<typeof RecentPostsPreview>[0]> = {}) {
  return render(
    <RecentPostsPreview
      posts={[]}
      players={players}
      uid="uid1"
      likesByPost={new Map()}
      onToggleLike={vi.fn()}
      onSelectParticipant={vi.fn()}
      onDeletePost={vi.fn()}
      onSaveEdit={vi.fn()}
      onRefetch={vi.fn()}
      {...overrides}
    />
  );
}

describe("RecentPostsPreview", () => {
  it("shows an empty state when there are no posts", () => {
    renderPreview();
    expect(screen.getByText("Nothing posted yet.")).toBeInTheDocument();
  });

  it("only shows top-level posts as their own row", () => {
    renderPreview({
      posts: [
        post({ id: "thread", text: "Bir konu", createdAt: 100 }),
        post({ id: "reply", text: "Bir cevap", parentId: "thread", createdAt: 150 }),
      ],
    });
    expect(screen.queryByText("Bir cevap")).not.toBeInTheDocument();
    expect(screen.getByText("Bir konu")).toBeInTheDocument();
  });

  it("sorts by last activity, so a reply bumps an older thread ahead of a newer quiet one", () => {
    renderPreview({
      posts: [
        post({ id: "old", text: "Eski konu", createdAt: 100 }),
        post({ id: "old-reply", text: "cevap", parentId: "old", createdAt: 900 }),
        post({ id: "new", text: "Yeni konu", createdAt: 500 }),
      ],
    });
    const texts = screen.getAllByText(/konu/).map((el) => el.textContent);
    expect(texts).toEqual(["Eski konu", "Yeni konu"]);
  });

  it("shows a reply count per thread, including nested replies-to-replies", () => {
    renderPreview({
      posts: [
        post({ id: "thread", createdAt: 100 }),
        post({ id: "r1", parentId: "thread", createdAt: 200 }),
        post({ id: "r2", parentId: "r1", createdAt: 300 }),
      ],
    });
    expect(screen.getByText("2 replies")).toBeInTheDocument();
  });

  it("shows a zero reply count for a thread with no replies", () => {
    renderPreview({ posts: [post({})] });
    expect(screen.getByText("0 replies")).toBeInTheDocument();
  });

  it("defaults to showing at most 3 posts", () => {
    const posts = Array.from({ length: 5 }, (_, i) => post({ id: `p${i}`, text: `Post ${i}`, createdAt: i }));
    renderPreview({ posts });
    expect(screen.getAllByText(/^Post \d$/)).toHaveLength(3);
  });

  it("respects a custom limit prop", () => {
    const posts = Array.from({ length: 5 }, (_, i) => post({ id: `p${i}`, text: `Post ${i}`, createdAt: i }));
    renderPreview({ posts, limit: 2 });
    expect(screen.getAllByText(/^Post \d$/)).toHaveLength(2);
  });

  it("shows 'Deleted' when no matching player is found (a deleted account)", () => {
    renderPreview({ posts: [post({ uid: "unknown-uid" })], players: [] });
    expect(screen.getByText("Deleted")).toBeInTheDocument();
  });

  it("shows a thumbnail when a post has an image, and none when it doesn't", () => {
    renderPreview({
      posts: [
        post({ id: "with-image", text: "Resimli", imageURL: "https://example.com/a.jpg", createdAt: 2 }),
        post({ id: "without-image", text: "Resimsiz", createdAt: 1 }),
      ],
    });
    const withImageRow = screen.getByText("Resimli").closest("li")!;
    const withoutImageRow = screen.getByText("Resimsiz").closest("li")!;
    // ForumImageThumb doesn't mount its <img> until the photo has actually
    // decoded (2026-08-03) — the skeleton placeholder is what's there
    // immediately, exactly what this assertion cares about either way.
    expect(withImageRow.querySelector('[data-testid="forum-image-skeleton"]')).toBeInTheDocument();
    expect(withoutImageRow.querySelector('[data-testid="forum-image-skeleton"]')).not.toBeInTheDocument();
  });

  it("marks the like button pressed and shows the count when the current user has liked it", () => {
    renderPreview({ posts: [post({})], likesByPost: new Map([["p1", new Set(["uid1", "uid2"])]]) });
    const likeButton = screen.getByRole("button", { name: "Unlike" });
    expect(likeButton).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("still shows a zero count when nobody has liked a post yet (a count that appears/disappears shifts the row)", () => {
    renderPreview({ posts: [post({})], likesByPost: new Map() });
    const likeButton = screen.getByRole("button", { name: "Like" });
    expect(likeButton).toHaveAttribute("aria-pressed", "false");
    expect(within(likeButton).getByText("0")).toBeInTheDocument();
  });

  it("calls onToggleLike with the post id when the like button is clicked", () => {
    const onToggleLike = vi.fn();
    renderPreview({ posts: [post({ id: "p1" })], onToggleLike });
    fireEvent.click(screen.getByRole("button", { name: "Like" }));
    expect(onToggleLike).toHaveBeenCalledWith("p1");
  });

  it("opens the thread popup (with the full text) when the row itself is clicked", () => {
    renderPreview({ posts: [post({ id: "p1", text: "Clickable row" })] });
    fireEvent.click(screen.getByText("Clickable row"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("clicking the like button does not also open the thread popup", () => {
    renderPreview({ posts: [post({ id: "p1" })] });
    fireEvent.click(screen.getByRole("button", { name: "Like" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("clicking the reply count opens the thread popup", () => {
    renderPreview({ posts: [post({ id: "p1" })] });
    fireEvent.click(screen.getByText("0 replies"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("RecentPostsPreview — logged out (uid null)", () => {
  it("renders the like button disabled with a sign-in-prompt label", () => {
    renderPreview({ posts: [post({})], uid: null });
    const likeButton = screen.getByRole("button", { name: "Sign in to like" });
    expect(likeButton).toBeDisabled();
  });

  it("does not call onToggleLike when the disabled like button is clicked", () => {
    const onToggleLike = vi.fn();
    renderPreview({ posts: [post({})], uid: null, onToggleLike });
    fireEvent.click(screen.getByRole("button", { name: "Sign in to like" }));
    expect(onToggleLike).not.toHaveBeenCalled();
  });

  it("still shows the like count for a logged-out viewer", () => {
    renderPreview({
      posts: [post({})],
      uid: null,
      likesByPost: new Map([["p1", new Set(["someone-else"])]]),
    });
    const likeButton = screen.getByRole("button", { name: "Sign in to like" });
    expect(within(likeButton).getByText("1")).toBeInTheDocument();
  });

  it("the row itself still opens the thread popup for a logged-out viewer", () => {
    renderPreview({ posts: [post({ text: "Clickable" })], uid: null });
    fireEvent.click(screen.getByText("Clickable"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("ForumPreviewFooter", () => {
  it("links through to the full forum", () => {
    render(
      <MemoryRouter>
        <ForumPreviewFooter />
      </MemoryRouter>
    );
    expect(screen.getByRole("link", { name: "Open forum" })).toHaveAttribute("href", "/forum");
  });
});
