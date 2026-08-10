// src/forum/PostAuthorLink.tsx
import type { ReactNode, MouseEvent } from "react";
import { Player } from "../profile/usePlayers";
import { fullName, avatarSrc, initials } from "../profile/deletedAccount";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface PostAuthorLinkProps {
  author: Player | undefined;
  /** The post's author uid — passed through rather than read off `author`,
   *  which is undefined for a deleted account but still has a real uid. */
  uid: string;
  onSelect: (uid: string) => void;
  avatarClassName?: string;
  fallbackClassName?: string;
  nameClassName?: string;
  /** Rendered directly under the name (timestamp, "· edited", …). Sits
   *  outside the name's own click target so only the name itself is a link. */
  meta?: ReactNode;
  /** Replaces the plain name span — used by ThreadPopup, whose name has to
   *  be the accessible DialogTitle element rather than a bare span. */
  nameSlot?: ReactNode;
  /** Set on rows that are themselves a click target (RecentPostsPreview's
   *  whole-row opener), so hitting the avatar/name opens the participant
   *  rather than also firing the row underneath. */
  stopPropagation?: boolean;
  className?: string;
}

/**
 * Author avatar + name as two *independent* buttons, both opening that
 * participant's popup. They used to be one wrapping button — visually
 * identical, but it meant the name and the picture were a single target, and
 * a DialogTitle nested inside a <button> in ThreadPopup's case. Split here
 * once instead of four times across the forum surfaces.
 */
export function PostAuthorLink({
  author,
  uid,
  onSelect,
  avatarClassName,
  fallbackClassName,
  nameClassName,
  meta,
  nameSlot,
  stopPropagation,
  className,
}: PostAuthorLinkProps) {
  function handle(e: MouseEvent) {
    if (stopPropagation) e.stopPropagation();
    onSelect(uid);
  }

  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <button
        type="button"
        onClick={handle}
        aria-label={`${fullName(author)} profile`}
        className="shrink-0 cursor-pointer rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-color_accent"
      >
        <Avatar className={cn("size-8 shrink-0", avatarClassName)}>
          <AvatarImage src={avatarSrc(author)} alt="" />
          <AvatarFallback className={cn("font-mono text-[0.6rem] text-color_textsecondary", fallbackClassName)}>
            {initials(author)}
          </AvatarFallback>
        </Avatar>
      </button>
      <span className="min-w-0 text-left">
        <button
          type="button"
          onClick={handle}
          className={cn(
            "block max-w-full cursor-pointer truncate text-left font-display text-sm font-medium text-color_text outline-none hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-color_accent",
            nameClassName
          )}
        >
          {nameSlot ?? fullName(author)}
        </button>
        {meta}
      </span>
    </div>
  );
}
