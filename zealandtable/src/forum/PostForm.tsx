// src/forum/PostForm.tsx
import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { ImagePlus, Quote, X } from "lucide-react";
import { createPost, QuoteRef } from "./createPost";
import { POST_MAX_LENGTH, POST_LENGTH_WARNING_AT } from "./postTypes";
import { useSendCooldown } from "../lib/useSendCooldown";
import { resolveMentionedUids, findActiveMentionQuery, matchMentionCandidates, insertMention, MentionQuery } from "../chat/chatMentions";
import { Player } from "../profile/usePlayers";
import { cn } from "@/lib/utils";

interface PostFormProps {
  uid: string;
  parentId: string | null;
  onPosted: () => void;
  /** Needed for the "@" autocomplete and to resolve mentioned uids at
   *  submit time — same convention as ChatComposer.tsx (chatMentions.ts is
   *  generic, reused as-is here). Omit it if no player list is in scope
   *  yet; mentions just won't autocomplete. */
  players?: Player[];
  placeholder?: string;
  autoFocus?: boolean;
  /** A reply staged via ReplyRow's quote button (forum-round-01/02) — shown
   *  as a dismissible chip above the textarea. Only ever passed for a reply
   *  composer, never the new-thread box. */
  quote?: QuoteRef | null;
  onClearQuote?: () => void;
}

export function PostForm({
  uid,
  parentId,
  onPosted,
  players = [],
  placeholder = "Say something…",
  autoFocus = false,
  quote = null,
  onClearQuote,
}: PostFormProps) {
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mention, setMention] = useState<MentionQuery | null>(null);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isCoolingDown, trigger: triggerCooldown } = useSendCooldown();

  const mentionCandidates = players.filter((p) => p.uid !== uid);
  const candidates = mention ? matchMentionCandidates(mentionCandidates, mention.query) : [];
  const showDropdown = mention !== null && candidates.length > 0;

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  function handleChange(value: string) {
    setText(value);
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
    if ((!text.trim() && !imageFile) || isCoolingDown) return;
    try {
      await createPost(uid, text, imageFile, parentId, resolveMentionedUids(text, players), quote);
      triggerCooldown();
      setText("");
      setImageFile(null);
      setError(null);
      onClearQuote?.();
      onPosted();
    } catch (err) {
      console.error("Failed to create post", err);
      setError("Couldn’t post that. Try again.");
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

  return (
    <form onSubmit={handleSubmit} className="relative flex flex-col gap-2">
      {quote && (
        <div className="flex items-start gap-2 rounded-md border-l-2 border-color_accent/50 bg-color_accent/[0.06] py-1.5 pr-2 pl-2.5 text-xs text-color_text/80">
          <Quote className="mt-0.5 size-3 shrink-0 text-color_accent" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{quote.text}</span>
          <button
            type="button"
            onClick={onClearQuote}
            aria-label="Remove quote"
            className="shrink-0 cursor-pointer text-color_textsecondary hover:text-color_text"
          >
            <X className="size-3" aria-hidden />
          </button>
        </div>
      )}

      {showDropdown && (
        <ul className="absolute bottom-full left-0 z-10 mb-1.5 max-h-40 w-48 overflow-y-auto rounded-xl border border-color_border1 bg-popover py-1 shadow-frame">
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

      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          maxLength={POST_MAX_LENGTH}
          rows={1}
          className="no-scrollbar max-h-40 min-w-0 flex-1 resize-none overflow-y-auto rounded-2xl border border-color_border1/70 bg-background px-4 py-2 text-sm text-color_text outline-none placeholder:text-color_textsecondary focus:border-color_accent"
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png, image/jpeg, image/webp"
          className="sr-only"
          onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Add image"
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-color_textsecondary outline-none transition-colors hover:text-color_accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-color_accent"
        >
          <ImagePlus className="size-4" aria-hidden />
        </button>
        <button
          type="submit"
          disabled={isCoolingDown}
          className="shrink-0 cursor-pointer rounded-lg bg-color_text px-4 py-2 text-sm font-medium text-background outline-none transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-color_accent disabled:cursor-default disabled:opacity-40"
        >
          Post
        </button>
      </div>

      {imagePreviewUrl && (
        <div className="relative w-fit">
          <img
            src={imagePreviewUrl}
            alt="Selected image preview"
            className="max-h-28 rounded-lg border border-color_border1/60 object-cover"
          />
          <button
            type="button"
            onClick={() => setImageFile(null)}
            aria-label="Remove image"
            className="absolute -top-1.5 -right-1.5 flex size-5 cursor-pointer items-center justify-center rounded-full border border-color_border1 bg-background text-color_textsecondary hover:text-color_remove"
          >
            <X className="size-3" aria-hidden />
          </button>
        </div>
      )}

      {(error || text.length >= POST_LENGTH_WARNING_AT) && (
        <div className="flex items-center justify-between gap-2">
          {error ? (
            <p role="alert" className="text-xs text-color_remove">
              {error}
            </p>
          ) : (
            <span />
          )}
          {text.length >= POST_LENGTH_WARNING_AT && (
            <span
              className={cn(
                "font-mono text-[0.65rem] tnum",
                text.length >= POST_MAX_LENGTH ? "text-color_remove" : "text-color_textsecondary"
              )}
            >
              {text.length} / {POST_MAX_LENGTH}
            </span>
          )}
        </div>
      )}
    </form>
  );
}
