import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Search, Trash2, X, Quote } from "lucide-react";
import { MessageWithId } from "./useMessages";
import { Player } from "../profile/usePlayers";
import { buildPlayersByUid } from "../profile/playersByUid";
import { deleteMessage } from "./deleteMessage";
import { fetchRecentMessagesForSearch, filterMessagesByTerm, SEARCH_WINDOW } from "./searchMessages";
import { buildChatItems, formatMessageTime, ChatItem } from "./chatGrouping";
import { splitMentionSegments } from "./chatMentions";
import { ChatComposer } from "./ChatComposer";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { fullName, firstNameOnly, avatarSrc, initials } from "../profile/deletedAccount";
import { QuotedMessage } from "./sendMessage";
import { cn } from "@/lib/utils";

interface ChatRoomProps {
  uid: string;
  /** The participant directory — every name, avatar and quote attribution in
   *  the transcript resolves through this. A uid that resolves to nothing is a
   *  deleted account and renders as such; that is why this must be the full
   *  directory and never a filtered slice. */
  players: Player[];
  mentionCandidates?: Player[];
  messages: MessageWithId[];
  onLoadOlder: () => void;
  loadingOlder: boolean;
  hasMoreOlder: boolean;
  typingUids: string[];
  onSelectParticipant: (uid: string) => void;
}

const SEARCH_DEBOUNCE_MS = 300;

function typingLineText(typingUids: string[], players: Player[]): string | null {
  if (typingUids.length === 0) return null;
  const names = typingUids
    .map((id) => players.find((p) => p.uid === id)?.displayName)
    .filter((name): name is string => Boolean(name));
  if (names.length === 0) return null;
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return `${names.length} people are typing…`;
}

function MessageText({ text, players }: { text: string; players: Player[] }) {
  const segments = splitMentionSegments(text, players);
  return (
    <p className="text-sm break-words whitespace-pre-wrap text-color_textsecondary">
      {segments.map((segment, i) =>
        segment.isMention ? (
          <span key={i} className="font-semibold text-color_accent">
            {segment.text}
          </span>
        ) : (
          <span key={i}>{segment.text}</span>
        )
      )}
    </p>
  );
}

function MessageRow({
  message,
  showHeader,
  isOwn,
  mentionsMe,
  author,
  players,
  onDelete,
  onSelectParticipant,
  onQuote,
  onJumpToQuote,
  highlighted,
  rowRef,
}: {
  message: MessageWithId;
  showHeader: boolean;
  isOwn: boolean;
  mentionsMe: boolean;
  author: Player | undefined;
  players: Player[];
  onDelete: (id: string) => void;
  onSelectParticipant: (uid: string) => void;
  onQuote: (message: MessageWithId) => void;
  onJumpToQuote: (messageId: string) => void;
  highlighted: boolean;
  rowRef: (el: HTMLLIElement | null) => void;
}) {
  const quoteAuthor = message.quotedAuthorUid ? players.find((p) => p.uid === message.quotedAuthorUid) : undefined;
  return (
    <li
      ref={rowRef}
      className={cn(
        "group flex items-start gap-2 rounded-lg transition-colors duration-700 ease-out",
        showHeader ? "pt-1.5" : "pt-0.5",
        highlighted && "bg-color_accent/[0.16]"
      )}
    >
      {showHeader ? (
        <button
          type="button"
          onClick={() => onSelectParticipant(message.uid)}
          className="shrink-0 cursor-pointer"
          aria-label={fullName(author)}
        >
          <Avatar className="size-6">
            <AvatarImage src={avatarSrc(author)} alt="" />
            <AvatarFallback className="font-mono text-[0.55rem] text-color_textsecondary">
              {initials(author)}
            </AvatarFallback>
          </Avatar>
        </button>
      ) : (
        <div className="size-6 shrink-0" />
      )}

      <div
        className={cn(
          "min-w-0 flex-1 rounded-xl px-3 py-1",
          mentionsMe ? "bg-color_gold/[0.1]" : "bg-transparent"
        )}
      >
        {showHeader && (
          <div className="mb-0.5 flex items-baseline gap-1.5">
            <button
              type="button"
              onClick={() => onSelectParticipant(message.uid)}
              className={cn(
                "cursor-pointer font-display text-xs font-semibold hover:underline",
                isOwn ? "text-color_accent" : "text-color_text"
              )}
            >
              {fullName(author)}
            </button>
            <span className="font-mono text-[0.6rem] text-color_textsecondary tnum">
              {formatMessageTime(message.createdAt)}
            </span>
          </div>
        )}
        {message.quotedMessageId && (
          <button
            type="button"
            onClick={() => onJumpToQuote(message.quotedMessageId!)}
            className="mb-1 flex w-full cursor-pointer items-start rounded-md border-l-2 border-color_accent/50 py-1 pl-2 text-left text-[0.76rem] leading-snug hover:bg-color_accent/[0.08]"
          >
            <span className="min-w-0 truncate">
              <span className="font-medium text-color_accent">{firstNameOnly(quoteAuthor)}: </span>
              <span className="text-color_textsecondary">&ldquo;{message.quotedText}&rdquo;</span>
            </span>
          </button>
        )}
        {message.deleted ? (
          <p className="text-sm text-color_textsecondary italic">This message was deleted.</p>
        ) : (
          <MessageText text={message.text} players={players} />
        )}
      </div>

      {!message.deleted && (
        <div className="flex shrink-0 flex-col gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
          {isOwn && (
            <button
              type="button"
              onClick={() => onDelete(message.id)}
              aria-label="Delete message"
              className="cursor-pointer rounded-full p-1 text-color_textsecondary outline-none hover:text-color_remove focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-color_accent"
            >
              <Trash2 className="size-3" aria-hidden />
            </button>
          )}
          <button
            type="button"
            onClick={() => onQuote(message)}
            aria-label="Quote"
            className="cursor-pointer rounded-full p-1 text-color_textsecondary outline-none hover:text-color_accent focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-color_accent"
          >
            <Quote className="size-3" aria-hidden />
          </button>
        </div>
      )}
    </li>
  );
}

/**
 * The chat/forum are DESIGN.md's designated outlet for warmth and banter —
 * genuinely loose, not just microscopically different from the rest of the
 * site (§6's Do list). Own messages get a faint color_accent-tinted background;
 * a message that @mentions the current user gets a faint amber tint instead
 * (chat-widget-round-01 Q14) — everyone else's stay plain.
 *
 * `messages` arrives pre-capped and chronological (useMessages.ts caps the
 * live window and exposes onLoadOlder for history beyond it — Q2).
 */
export function ChatRoom({
  uid,
  players,
  mentionCandidates,
  messages,
  onLoadOlder,
  loadingOlder,
  hasMoreOlder,
  typingUids,
  onSelectParticipant,
}: ChatRoomProps) {
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MessageWithId[]>([]);
  const [searching, setSearching] = useState(false);
  // True when the fetch came back exactly full, i.e. there is older history the
  // window did not cover — used only to keep the no-results message honest.
  const [searchWindowFull, setSearchWindowFull] = useState(false);
  const [quoted, setQuoted] = useState<QuotedMessage | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLLIElement>());

  const listRef = useRef<HTMLUListElement>(null);
  const prevFirstIdRef = useRef<string | null>(null);
  const prevScrollHeightRef = useRef(0);
  // Tracks whether the user was already scrolled to (near) the bottom right
  // before this render's messages update — updated continuously on scroll,
  // not computed after the fact. Without this, any re-render of `messages`
  // (a new message arriving, or even an unrelated snapshot re-emit) forced
  // scrollTop to the bottom unconditionally, yanking someone back down mid-
  // read the instant they'd scrolled up even slightly.
  const wasAtBottomRef = useRef(true);
  const NEAR_BOTTOM_PX = 80;
  // not-started-audit item 18: this used to re-run a full, unbounded fetch
  // of the entire message history on every debounced keystroke. Now it
  // fetches once per search session (while the panel stays open) and every
  // later keystroke just filters that same in-memory list — reopening the
  // panel later still gets a fresh fetch, since this resets to null on close.
  const allMessagesCacheRef = useRef<MessageWithId[] | null>(null);

  function handleScroll() {
    const el = listRef.current;
    if (!el) return;
    wasAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
  }

  const playersByUid = useMemo(() => buildPlayersByUid(players), [players]);
  const items: ChatItem[] = useMemo(() => buildChatItems(messages), [messages]);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const firstId = messages[0]?.id ?? null;

    if (prevFirstIdRef.current !== null && messages.length > 0 && firstId !== prevFirstIdRef.current) {
      // Older messages were just prepended (onLoadOlder) — keep whatever was
      // on screen anchored in place instead of jumping.
      el.scrollTop += el.scrollHeight - prevScrollHeightRef.current;
    } else if (prevFirstIdRef.current === null || wasAtBottomRef.current) {
      // First mount, or the user was already at the bottom — follow new
      // messages down. Otherwise leave their scroll position alone.
      el.scrollTop = el.scrollHeight;
      wasAtBottomRef.current = true;
    }

    prevFirstIdRef.current = firstId;
    prevScrollHeightRef.current = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!searchOpen) {
      allMessagesCacheRef.current = null;
      return;
    }
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const id = setTimeout(() => {
      const cached = allMessagesCacheRef.current;
      const load = cached
        ? Promise.resolve(cached)
        : fetchRecentMessagesForSearch().then((all) => {
            allMessagesCacheRef.current = all;
            return all;
          });
      load
        .then((all) => {
          setSearchWindowFull(all.length >= SEARCH_WINDOW);
          setSearchResults(filterMessagesByTerm(all, trimmed));
        })
        .catch((err) => console.error("Failed to search messages", err))
        .finally(() => setSearching(false));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [searchQuery, searchOpen]);

  function handleQuote(message: MessageWithId) {
    setQuoted({ id: message.id, uid: message.uid, text: message.text });
  }

  function handleJumpToQuote(messageId: string) {
    const el = rowRefs.current.get(messageId);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    setHighlightedId(messageId);
    setTimeout(() => setHighlightedId((current) => (current === messageId ? null : current)), 1500);
  }

  function closeSearch() {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
  }

  async function handleDelete(messageId: string) {
    setDeleteError(null);
    try {
      await deleteMessage(messageId);
    } catch (err) {
      console.error("Failed to delete message", err);
      setDeleteError("Mesaj silinemedi, tekrar deneyin.");
    }
  }

  const typingText = typingLineText(typingUids, players);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {searchOpen ? (
        <div className="flex shrink-0 items-center gap-1.5 border-b border-color_border1/50 px-3 py-1.5 sm:px-4">
          <input
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chat…"
            className="min-w-0 flex-1 rounded-full border border-color_border1/70 bg-background px-3 py-1 text-xs text-color_text outline-none placeholder:text-color_textsecondary focus:border-color_accent"
          />
          <button
            type="button"
            onClick={closeSearch}
            aria-label="Close search"
            className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-color_textsecondary outline-none transition-colors hover:text-color_accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-color_accent"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-label="Search chat"
          className="absolute top-1.5 right-3 z-10 flex size-6 cursor-pointer items-center justify-center rounded-full text-color_textsecondary outline-none transition-colors hover:text-color_accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-color_accent sm:right-4"
        >
          <Search className="size-3.5" aria-hidden />
        </button>
      )}

      {searchOpen ? (
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-3 sm:px-6">
          {searching && <p className="text-center text-xs text-color_textsecondary">Searching…</p>}
          {!searching && searchQuery.trim() && searchResults.length === 0 && (
            <p className="text-center text-xs text-color_textsecondary">
              {searchWindowFull
                ? `No matches. Search covers the last ${SEARCH_WINDOW} messages.`
                : "No matches."}
            </p>
          )}
          <ul className="flex flex-col gap-3">
            {searchResults.map((message) => {
              const author = playersByUid.get(message.uid);
              return (
                <li key={message.id} className="rounded-lg border border-color_border1/50 px-3 py-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectParticipant(message.uid)}
                      className="cursor-pointer font-display text-xs font-semibold text-color_text hover:underline"
                    >
                      {fullName(author)}
                    </button>
                    <span className="shrink-0 font-mono text-[0.6rem] text-color_textsecondary tnum">
                      {formatMessageTime(message.createdAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-sm text-color_textsecondary">{message.text}</p>
                </li>
              );
            })}
          </ul>
        </div>
      ) : messages.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-5 py-8 sm:px-6">
          <p className="text-center font-display text-sm text-color_textsecondary italic">Nothing said yet.</p>
        </div>
      ) : (
        <ul ref={listRef} onScroll={handleScroll} className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-1.5 sm:px-6">
          {hasMoreOlder && (
            <li className="flex justify-center pb-1.5">
              <button
                type="button"
                onClick={onLoadOlder}
                disabled={loadingOlder}
                className="cursor-pointer rounded-full border border-color_border1/70 px-3 py-1 font-mono text-[0.62rem] text-color_textsecondary uppercase outline-none transition-colors hover:text-color_accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-color_accent disabled:cursor-default disabled:opacity-60"
              >
                {loadingOlder ? "Loading…" : "Load older messages"}
              </button>
            </li>
          )}
          {items.map((item) =>
            item.type === "divider" ? (
              <li key={item.key} className="flex justify-center py-1.5">
                <span className="rounded-full bg-color_secondary px-3 py-1 font-mono text-[0.62rem] tracking-wide text-color_textsecondary uppercase">
                  {item.label}
                </span>
              </li>
            ) : (
              <MessageRow
                key={item.key}
                message={item.message}
                showHeader={item.showHeader}
                isOwn={item.message.uid === uid}
                mentionsMe={item.message.mentionedUids?.includes(uid) ?? false}
                author={playersByUid.get(item.message.uid)}
                players={players}
                onDelete={handleDelete}
                onSelectParticipant={onSelectParticipant}
                onQuote={handleQuote}
                onJumpToQuote={handleJumpToQuote}
                highlighted={highlightedId === item.message.id}
                rowRef={(el) => {
                  if (el) rowRefs.current.set(item.message.id, el);
                  else rowRefs.current.delete(item.message.id);
                }}
              />
            )
          )}
        </ul>
      )}

      <div className="h-5 shrink-0 px-5 sm:px-6" aria-live="polite">
        {typingText && <p className="text-xs text-color_textsecondary italic">{typingText}</p>}
      </div>

      <ChatComposer
        uid={uid}
        players={players}
        mentionCandidates={mentionCandidates}
        quoted={quoted}
        onClearQuote={() => setQuoted(null)}
      />
      {deleteError && (
        <p role="alert" className="px-3 pb-2 text-xs text-color_remove sm:px-4">
          {deleteError}
        </p>
      )}
    </div>
  );
}
