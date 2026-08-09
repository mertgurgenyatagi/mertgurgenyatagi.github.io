import { Check } from "lucide-react";
import { Player } from "../profile/usePlayers";
import { fullName, initials } from "../profile/deletedAccount";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface ParticipantStatusListProps {
  players: Player[];
  submitterUids: Set<string>;
  /** Opens that player's participant popup — omitted wherever the caller
   *  hasn't wired one up, in which case rows are plain, non-interactive. */
  onSelectPlayer?: (uid: string) => void;
}

/**
 * "Full list of participants" per Mert's sketch — every signed-up player,
 * alphabetical (easiest to scan for your own name / a specific friend's),
 * with a gold tick marking who's already submitted their league prediction.
 * Gold here is literally Tailwind's color_gold/500 — the same "gold" already
 * used for rank numerals and standout figures elsewhere (RankingList,
 * ParticipantPopup), not the site's --color_accent token (which reads green despite
 * its name, a leftover from the dark-theme rework).
 */
export function ParticipantStatusList({ players, submitterUids, onSelectPlayer }: ParticipantStatusListProps) {
  const sorted = [...players].sort((a, b) => fullName(a).localeCompare(fullName(b), "tr"));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-baseline justify-between border-b border-color_border1/50 px-5 py-2.5 sm:px-6">
        <span className="font-mono text-[0.62rem] tracking-[0.14em] text-color_textsecondary uppercase">
          Predicted
        </span>
        <span className="font-mono text-[0.68rem] text-color_gold tnum">
          {submitterUids.size} / {players.length}
        </span>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-5 py-8 sm:px-6">
          <p className="text-center font-display text-sm text-color_textsecondary italic">Nobody has joined yet.</p>
        </div>
      ) : (
        <ul className="no-scrollbar min-h-0 flex-1 divide-y divide-border/50 overflow-y-auto px-3 sm:px-4">
          {sorted.map((player) => {
            const submitted = submitterUids.has(player.uid);
            return (
              <li
                key={player.uid}
                onClick={onSelectPlayer ? () => onSelectPlayer(player.uid) : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors duration-150 ease-[var(--ease-cotton)]",
                  onSelectPlayer && "cursor-pointer hover:bg-color_text/[0.06]"
                )}
              >
                <Avatar className="size-8 shrink-0">
                  <AvatarImage src={player.photoURL} alt="" />
                  <AvatarFallback className="font-mono text-[0.6rem] text-color_textsecondary">
                    {initials(player)}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 truncate font-display text-sm text-color_text">
                  {fullName(player)}
                </span>
                <span
                  aria-label={submitted ? "Has predicted" : "Hasn’t predicted yet"}
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border",
                    submitted ? "border-color_gold/40 bg-color_gold/15 text-color_gold" : "border-color_border1/60 text-transparent"
                  )}
                >
                  <Check className="size-3" strokeWidth={3} aria-hidden />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
