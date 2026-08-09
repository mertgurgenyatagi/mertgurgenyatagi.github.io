import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { Player } from "../profile/usePlayers";

const mockSendMessage = vi.fn();
const mockSetTypingStatus = vi.fn();

vi.mock("./sendMessage", () => ({
  sendMessage: (...args: unknown[]) => mockSendMessage(...args),
}));
vi.mock("./useTypingStatus", () => ({
  setTypingStatus: (...args: unknown[]) => mockSetTypingStatus(...args),
}));

import { ChatComposer } from "./ChatComposer";

const players: Player[] = [
  { uid: "me", displayName: "Mert", photoURL: "", createdAt: 0 },
  { uid: "uid-ada", displayName: "Ada", photoURL: "", createdAt: 1 },
];

describe("ChatComposer", () => {
  beforeEach(() => {
    mockSendMessage.mockReset();
    mockSetTypingStatus.mockReset();
    mockSetTypingStatus.mockResolvedValue(undefined);
  });

  it("sends the typed message on submit and clears the input", async () => {
    mockSendMessage.mockResolvedValue(undefined);
    render(<ChatComposer uid="me" players={players} quoted={null} onClearQuote={() => {}} />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Merhaba millet" } });
    fireEvent.click(screen.getByText("Send"));
    expect(mockSendMessage).toHaveBeenCalledWith("me", "Merhaba millet", [], null);
    await waitFor(() => expect(textarea).toHaveValue(""));
  });

  it("does not send an empty message", () => {
    render(<ChatComposer uid="me" players={players} quoted={null} onClearQuote={() => {}} />);
    fireEvent.click(screen.getByText("Send"));
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("shows an inline error and keeps the typed text when sending fails", async () => {
    mockSendMessage.mockRejectedValue(new Error("permission-denied"));
    render(<ChatComposer uid="me" players={players} quoted={null} onClearQuote={() => {}} />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Don't lose this" } });
    fireEvent.click(screen.getByText("Send"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn’t send that. Try again.");
    expect(textarea).toHaveValue("Don't lose this");
  });

  it("submits on Enter without Shift", async () => {
    mockSendMessage.mockResolvedValue(undefined);
    render(<ChatComposer uid="me" players={players} quoted={null} onClearQuote={() => {}} />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "quick message" } });
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(mockSendMessage).toHaveBeenCalledWith("me", "quick message", [], null);
    await waitFor(() => expect(textarea).toHaveValue(""));
  });

  it("does not submit on Shift+Enter", () => {
    render(<ChatComposer uid="me" players={players} quoted={null} onClearQuote={() => {}} />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "a line" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("caps input length via maxLength", () => {
    render(<ChatComposer uid="me" players={players} quoted={null} onClearQuote={() => {}} />);
    expect(screen.getByRole("textbox")).toHaveAttribute("maxLength", "360");
  });

  it("shows a character counter only once the 300 mark is crossed", () => {
    render(<ChatComposer uid="me" players={players} quoted={null} onClearQuote={() => {}} />);
    const textarea = screen.getByRole("textbox");

    fireEvent.change(textarea, { target: { value: "a".repeat(299) } });
    expect(screen.queryByText(/\/ 360/)).not.toBeInTheDocument();

    fireEvent.change(textarea, { target: { value: "a".repeat(300) } });
    expect(screen.getByText("300 / 360")).toBeInTheDocument();
  });

  it("reports typing to setTypingStatus while composing, and clears it after sending", async () => {
    mockSendMessage.mockResolvedValue(undefined);
    render(<ChatComposer uid="me" players={players} quoted={null} onClearQuote={() => {}} />);
    const textarea = screen.getByRole("textbox");

    fireEvent.change(textarea, { target: { value: "typing away" } });
    expect(mockSetTypingStatus).toHaveBeenCalledWith("me", true);

    fireEvent.click(screen.getByText("Send"));
    await waitFor(() => expect(mockSetTypingStatus).toHaveBeenLastCalledWith("me", false));
  });

  it("clears typing status when the input is emptied without sending", () => {
    render(<ChatComposer uid="me" players={players} quoted={null} onClearQuote={() => {}} />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "a" } });
    fireEvent.change(textarea, { target: { value: "" } });
    expect(mockSetTypingStatus).toHaveBeenLastCalledWith("me", false);
  });

  it("shows mention suggestions matching the @query, excluding the composer's own uid", () => {
    render(<ChatComposer uid="me" players={players} quoted={null} onClearQuote={() => {}} />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "@a" } });
    expect(screen.getByText("Ada")).toBeInTheDocument();
    expect(screen.queryByText("Mert")).not.toBeInTheDocument();
  });

  it("inserts the picked mention into the text and hides the dropdown", () => {
    render(<ChatComposer uid="me" players={players} quoted={null} onClearQuote={() => {}} />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "@a" } });
    fireEvent.click(screen.getByText("Ada"));
    expect(textarea).toHaveValue("@Ada ");
    expect(screen.queryByText("Ada")).not.toBeInTheDocument();
  });

  it("resolves @mentions in the sent text to uids", async () => {
    mockSendMessage.mockResolvedValue(undefined);
    render(<ChatComposer uid="me" players={players} quoted={null} onClearQuote={() => {}} />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "@Ada bak buna" } });
    fireEvent.click(screen.getByText("Send"));
    expect(mockSendMessage).toHaveBeenCalledWith("me", "@Ada bak buna", ["uid-ada"], null);
    await waitFor(() => expect(textarea).toHaveValue(""));
  });


});
