import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { Send, X } from "lucide-react";
import { Player } from "../profile/usePlayers";
import { sendMessage, QuotedMessage } from "./sendMessage";
import { setTypingStatus } from "./useTypingStatus";
import { fullName } from "../profile/deletedAccount";
import { MESSAGE_MAX_LENGTH, MESSAGE_LENGTH_WARNING_AT } from "./messageTypes";
import { useSendCooldown } from "../lib/useSendCooldown";
import {
  findActiveMentionQuery,
  matchMentionCandidates,
  insertMention,
  resolveMentionedUids,
  MentionQuery,
} from "./chatMentions";
import { cn } from "@/lib/utils";

interface ChatComposerProps {
  uid: string;
  /** The participant directory — names the author of whatever is being
   *  quoted, and supplies the @-mention candidates. The parent takes a second,
   *  lobby-scoped list here; irishtable has one room, so there is one list. */
  players: Player[];
  mentionCandidates?: Player[];
  quoted: QuotedMessage | null;
  onClearQuote: () => void;
}

// Re-sending "still typing" more often than this would just be noise —
// useTypingStatus.ts's reader-side staleness window (6s) is what actually
// makes the indicator disappear if someone stops without this ever firing
// a "false".
const TYPING_RESEND_MS = 2000;
const MAX_TEXTAREA_HEIGHT_PX = 112;

export function ChatComposer({
  uid,
  players,
  mentionCandidates: mentionablePlayers,
  quoted,
  onClearQuote,
}: ChatComposerProps) {
  const mentionable = mentionablePlayers ?? players;
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mention, setMention] = useState<MentionQuery | null>(null);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastTypingSentRef = useRef(0);
  const { isCoolingDown, trigger: triggerCooldown } = useSendCooldown();

  const selectableMentions = mentionable.filter((p) => p.uid !== uid);
  const candidates = mention ? matchMentionCandidates(selectableMentions, mention.query) : [];
  const showDropdown = mention !== null && candidates.length > 0;

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT_PX)}px`;
  }, [text]);

  useEffect(() => {
    if (quoted) textareaRef.current?.focus();
  }, [quoted]);

  function reportTyping(hasText: boolean) {
    const now = Date.now();
    if (hasText) {
      if (now - lastTypingSentRef.current > TYPING_RESEND_MS) {
        lastTypingSentRef.current = now;
        setTypingStatus(uid, true).catch((err) => console.error("Failed to send typing status", err));
      }
    } else {
      lastTypingSentRef.current = 0;
      setTypingStatus(uid, false).catch((err) => console.error("Failed to clear typing status", err));
    }
  }

  function handleChange(value: string) {
    setText(value);
    reportTyping(value.trim().length > 0);
    const cursor = textareaRef.current?.selectionStart ?? value.length;
    setMention(findActiveMentionQuery(value, cursor));
    setActiveSuggestion(0);
  }

  function pickMention(player: Player) {
    if (!mention || !textareaRef.current) return;
    const cursor = textareaRef.current.selectionStart ?? text.length;
    const result = insertMention(text, mention, cursor, player);
    setText(result.text);
    setMention(null);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(result.cursor, result.cursor);
    });
  }

  async function handleSubmit(event?: FormEvent) {
    event?.preventDefault();
    if (!text.trim() || isCoolingDown) return;
    const mentionedUids = resolveMentionedUids(text, mentionable);
    try {
      await sendMessage(uid, text, mentionedUids, quoted);
      triggerCooldown();
      setText("");
      setMention(null);
      setError(null);
      reportTyping(false);
      onClearQuote();
    } catch (err) {
      console.error("Failed to send message", err);
      setError("Couldn’t send that. Try again.");
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (showDropdown) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveSuggestion((i) => (i + 1) % candidates.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveSuggestion((i) => (i - 1 + candidates.length) % candidates.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        pickMention(candidates[activeSuggestion]);
        return;
      }
      if (event.key === "Escape") {
        setMention(null);
        return;
      }
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  }

  const length = text.length;
  const showCounter = length >= MESSAGE_LENGTH_WARNING_AT;

  return (
    <div className="relative shrink-0 border-t border-color_border1/50">
      {showDropdown && (
        <ul className="absolute bottom-full left-3 z-10 mb-1.5 max-h-40 w-48 overflow-y-auto rounded-xl border border-color_border1 bg-popover py-1 shadow-frame">
          {candidates.map((player, i) => (
            <li key={player.uid}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pickMention(player)}
                className={cn(
                  "block w-full cursor-pointer truncate px-3 py-1.5 text-left text-sm",
                  i === activeSuggestion ? "bg-color_accent/[0.12] text-color_accent" : "text-color_text hover:bg-color_secondary"
                )}
              >
                {player.displayName}
              </button>
            </li>
          ))}
        </ul>
      )}

      {quoted && (
        <div className="flex items-start gap-2 px-3 pt-2 sm:px-4">
          <div className="min-w-0 flex-1 rounded-lg border-l-2 border-color_accent/50 bg-color_secondary/50 py-1 pl-2 text-[0.76rem] leading-snug">
            <span className="font-medium text-color_accent">{fullName(players.find((p) => p.uid === quoted.uid))}: </span>
            <span className="text-color_textsecondary">&ldquo;{quoted.text}&rdquo;</span>
          </div>
          <button
            type="button"
            onClick={onClearQuote}
            aria-label="Remove quote"
            className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-color_textsecondary outline-none transition-colors hover:text-color_accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-color_accent"
          >
            <X className="size-3" aria-hidden />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-2 p-3 sm:px-4">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={MESSAGE_MAX_LENGTH}
          rows={1}
          placeholder="Say something…"
          className="no-scrollbar max-h-28 min-w-0 flex-1 resize-none overflow-y-auto rounded-2xl border border-color_border1/70 bg-background px-4 py-2 text-sm text-color_text outline-none placeholder:text-color_textsecondary focus:border-color_accent"
        />
        <button
          type="submit"
          disabled={isCoolingDown}
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-color_text text-background outline-none transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-color_accent disabled:cursor-default disabled:opacity-40"
        >
          <span className="sr-only">Send</span>
          <Send className="size-3.5" aria-hidden />
        </button>
      </form>

      {(error || showCounter) && (
        <div className="flex items-center justify-between px-3 pb-2 sm:px-4">
          {error ? (
            <p role="alert" className="text-xs text-color_remove">
              {error}
            </p>
          ) : (
            <span />
          )}
          {showCounter && (
            <span
              className={cn(
                "font-mono text-[0.65rem] tnum",
                length >= MESSAGE_MAX_LENGTH ? "text-color_remove" : "text-color_textsecondary"
              )}
            >
              {length} / {MESSAGE_MAX_LENGTH}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
