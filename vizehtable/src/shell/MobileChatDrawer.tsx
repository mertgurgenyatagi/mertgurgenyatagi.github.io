import { Users } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ChatRoom } from "../chat/ChatRoom";
import { useMessages } from "../chat/useMessages";
import { usePresenceHeartbeat, useOnlineCount } from "../chat/usePresence";
import { useTypingUsers } from "../chat/useTypingStatus";
import { usePlayers } from "../profile/usePlayers";
import { useMobilePopups } from "./MobilePopupHost";

/**
 * Chat, as a right-edge drawer reachable from every screen.
 *
 * On desktop, chat is a widget inside Home's bento. Mobile has no room for a
 * fourth thing on Home, so chat stops being page content and becomes an
 * app-level surface. That is the single largest structural difference between
 * the two layouts, and it is the non-busyness rule doing its job: Home gets
 * three widgets instead of four, and chat gets a full screen instead of a
 * corner.
 *
 * Everything here is a straight lift of `LoggedInHome`'s chat slice, minus the
 * parent's lobby-scope switching. The one thing that isn't: tapping a message
 * author goes through `useMobilePopups()` rather than local state, because a
 * drawer mounted in the shell has no page to hold that state for it.
 */
export function MobileChatDrawer({
  open,
  onOpenChange,
  uid,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  uid: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="p-0" aria-label="Chat">
        {/* Mounted only while open: these are live Firestore and RTDB
            listeners (messages, presence, typing), and a drawer nobody has
            opened shouldn't be paying for a chat subscription on every page.
            Unlike the popup host, this one does unmount on close — chat's
            listeners are the most expensive in the app, and reopening re-reads
            from Firestore's local cache anyway. */}
        {open && <ChatDrawerBody uid={uid} />}
      </SheetContent>
    </Sheet>
  );
}

function ChatDrawerBody({ uid }: { uid: string }) {
  const { players } = usePlayers();
  const { messages, loadOlder, loadingOlder, hasMoreOlder } = useMessages();
  const { openParticipant } = useMobilePopups();

  usePresenceHeartbeat(uid);
  const onlineCount = useOnlineCount();
  const typingUids = useTypingUsers(uid);

  return (
    <>
      <SheetHeader className="gap-2">
        <SheetTitle className="flex-1">Chat</SheetTitle>
        <span className="flex items-center gap-1.5 font-mono text-[0.65rem] text-color_textsecondary tnum">
          <Users className="size-3" aria-hidden />
          {onlineCount}
        </span>
      </SheetHeader>

      <div className="flex min-h-0 flex-1 flex-col px-3 pb-[env(safe-area-inset-bottom)]">
        <ChatRoom
          uid={uid}
          players={players}
          messages={messages}
          onLoadOlder={loadOlder}
          loadingOlder={loadingOlder}
          hasMoreOlder={hasMoreOlder}
          typingUids={typingUids}
          onSelectParticipant={openParticipant}
        />
      </div>
    </>
  );
}
