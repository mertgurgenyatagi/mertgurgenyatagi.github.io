// src/forum/PostForm.test.tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

const mockCreatePost = vi.fn();

vi.mock("./createPost", () => ({
  createPost: (...args: unknown[]) => mockCreatePost(...args),
}));

import { PostForm } from "./PostForm";

const players = [
  { uid: "uid1", displayName: "Mert", photoURL: "", createdAt: 1 },
  { uid: "uid2", displayName: "Ada", photoURL: "", createdAt: 1 },
];

describe("PostForm", () => {
  beforeEach(() => {
    mockCreatePost.mockReset();
  });

  it("submits the typed text with the given parentId, resolved mentions, and no quote by default", async () => {
    mockCreatePost.mockResolvedValue(undefined);
    const onPosted = vi.fn();
    render(<PostForm uid="uid1" parentId="thread-1" onPosted={onPosted} />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "New post" } });
    fireEvent.click(screen.getByText("Post"));
    expect(mockCreatePost).toHaveBeenCalledWith("uid1", "New post", null, "thread-1", [], null);
    await waitFor(() => expect(textarea).toHaveValue(""));
    expect(onPosted).toHaveBeenCalledTimes(1);
  });

  it("submits on Enter without Shift", async () => {
    mockCreatePost.mockResolvedValue(undefined);
    render(<PostForm uid="uid1" parentId={null} onPosted={vi.fn()} />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Quick post" } });
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(mockCreatePost).toHaveBeenCalledWith("uid1", "Quick post", null, null, [], null);
    await waitFor(() => expect(textarea).toHaveValue(""));
  });

  it("does not submit on Shift+Enter", () => {
    render(<PostForm uid="uid1" parentId={null} onPosted={vi.fn()} />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Multi line" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(mockCreatePost).not.toHaveBeenCalled();
  });

  it("does not submit when both text and image are empty", () => {
    render(<PostForm uid="uid1" parentId={null} onPosted={vi.fn()} />);
    fireEvent.click(screen.getByText("Post"));
    expect(mockCreatePost).not.toHaveBeenCalled();
  });

  it("shows an inline error and preserves the typed text when posting fails", async () => {
    mockCreatePost.mockRejectedValue(new Error("permission-denied"));
    render(<PostForm uid="uid1" parentId={null} onPosted={vi.fn()} />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Don’t lose this" } });
    fireEvent.click(screen.getByText("Post"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn’t post that. Try again.");
    expect(textarea).toHaveValue("Don’t lose this");
  });

  it("resolves and sends mentioned uids from typed @names", async () => {
    mockCreatePost.mockResolvedValue(undefined);
    render(<PostForm uid="uid1" parentId={null} onPosted={vi.fn()} players={players} />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "hey @Ada look at this" } });
    fireEvent.click(screen.getByText("Post"));
    expect(mockCreatePost).toHaveBeenCalledWith("uid1", "hey @Ada look at this", null, null, ["uid2"], null);
    await waitFor(() => expect(textarea).toHaveValue(""));
  });

  it("shows an autocomplete dropdown for '@' and inserts the picked name", () => {
    render(<PostForm uid="uid1" parentId={null} onPosted={vi.fn()} players={players} />);
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "hey @Ad" } });
    textarea.setSelectionRange(7, 7);
    fireEvent.change(textarea, { target: { value: "hey @Ad" } });
    expect(screen.getByText("Ada")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Ada"));
    expect(textarea).toHaveValue("hey @Ada ");
  });

  it("shows a dismissible quote chip and clears it via onClearQuote", () => {
    const onClearQuote = vi.fn();
    render(
      <PostForm
        uid="uid1"
        parentId="thread-1"
        onPosted={vi.fn()}
        quote={{ postId: "p2", authorUid: "uid2", text: "orijinal metin" }}
        onClearQuote={onClearQuote}
      />
    );
    expect(screen.getByText("orijinal metin")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Remove quote"));
    expect(onClearQuote).toHaveBeenCalledTimes(1);
  });

  it("previews a selected image and can remove it before posting", () => {
    render(<PostForm uid="uid1" parentId={null} onPosted={vi.fn()} />);
    const file = new File(["fake-image-bytes"], "photo.png", { type: "image/png" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByRole("img")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Remove image"));
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
