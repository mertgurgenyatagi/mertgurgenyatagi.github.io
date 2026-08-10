import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { useAuth } from "../auth/AuthProvider";
import { usePlayers } from "../profile/usePlayers";
import { TeamPopup } from "../leaderboard/TeamPopup";
import { ParticipantPopup } from "../leaderboard/ParticipantPopup";
import type { RankedEntry } from "../leaderboard/ranking";

/**
 * One popup layer for the whole mobile app, mounted once in MobileShell.
 *
 * On desktop each page carries its own copy of this state machine. That is
 * tolerable there because a desktop page is a self-contained screen. Mobile
 * breaks the assumption: chat is a shell-level drawer, not a widget on Home,
 * and tapping a message author has to open the same participant dossier the
 * participant list opens. A drawer that lives in the shell cannot reach into a
 * page's popup state, so the layer is hoisted once to the shell and every
 * mobile surface — pages and drawers alike — calls in through
 * `useMobilePopups()`.
 *
 * The two popups stay mutually exclusive, as on desktop: they cross-link into
 * each other, and stacking sheets is not worth the backdrop and z-index mess.
 *
 * **The data hook mounts lazily** — on first open, not on first render — so
 * mobile pages with no popups at all (About, Scoring, the logged-out landing)
 * never pay for it. Once opened it stays mounted, so reopening costs nothing.
 *
 * The parent also hosts a MatchupPopup here. irishtable has no fixtures, so
 * there is no third popup and no `openFixture`.
 */

interface MobilePopupApi {
  openTeam: (teamId: string) => void;
  openParticipant: (uid: string) => void;
}

/** No-op fallback: a component rendering on desktop (or in a test) has no host
 *  above it, and asking for popups there should do nothing rather than throw. */
const NOOP_API: MobilePopupApi = {
  openTeam: () => {},
  openParticipant: () => {},
};

const MobilePopupContext = createContext<MobilePopupApi>(NOOP_API);

export function useMobilePopups(): MobilePopupApi {
  return useContext(MobilePopupContext);
}

interface Selection {
  teamId: string | null;
  uid: string | null;
}

const NOTHING_SELECTED: Selection = { teamId: null, uid: null };

export function MobilePopupHost({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<Selection>(NOTHING_SELECTED);
  // Latches true on the first open and never resets — see the lazy-mount note
  // above. Deliberately not derived from `selection`, which goes back to nulls
  // on close.
  const [everOpened, setEverOpened] = useState(false);

  const api = useMemo<MobilePopupApi>(
    () => ({
      openTeam: (teamId) => {
        setEverOpened(true);
        setSelection({ teamId, uid: null });
      },
      openParticipant: (uid) => {
        setEverOpened(true);
        setSelection({ teamId: null, uid });
      },
    }),
    []
  );

  const close = useCallback(() => setSelection(NOTHING_SELECTED), []);

  return (
    <MobilePopupContext.Provider value={api}>
      {children}
      {everOpened && <MobilePopupLayer selection={selection} api={api} onClose={close} />}
    </MobilePopupContext.Provider>
  );
}

/** The half that actually fetches. Split out purely so the hook below does not
 *  run until something has been opened. */
function MobilePopupLayer({
  selection,
  api,
  onClose,
}: {
  selection: Selection;
  api: MobilePopupApi;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { players } = usePlayers();

  // There is no leaderboard and no scoring engine, so nothing produces a
  // populated entry. The popups are typed against the shape a future league
  // phase would fill, and every widget that would read it is gated on
  // `tournamentStarted`, which is permanently false here.
  const selectedRanked = useMemo<RankedEntry | null>(() => {
    if (!selection.uid) return null;
    const player = players.find((p) => p.uid === selection.uid);
    if (!player) return null;
    return {
      rank: 0,
      entry: {
        uid: player.uid,
        displayName: player.displayName,
        photoURL: player.photoURL,
        points: 0,
        ranking: [],
      },
    };
  }, [players, selection.uid]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) onClose();
    },
    [onClose]
  );

  return (
    <>
      <ParticipantPopup
        ranked={selectedRanked}
        entries={[]}
        players={players}
        results={{}}
        onOpenChange={handleOpenChange}
        onSelectTeam={api.openTeam}
        tournamentStarted={false}
        viewerLoggedIn={Boolean(user)}
      />
      <TeamPopup
        teamId={selection.teamId}
        entries={[]}
        players={players}
        results={{}}
        onOpenChange={handleOpenChange}
        onSelectParticipant={api.openParticipant}
        tournamentStarted={false}
      />
    </>
  );
}
