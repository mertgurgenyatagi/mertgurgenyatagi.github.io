import { useCallback, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { deleteDoc, doc, updateDoc } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { CameraIcon, Check, Pencil, Trash2, X } from "lucide-react";
import { db, photosEnabled, storage } from "@/firebase";
import { useAuth } from "../auth/AuthProvider";
import { useProfile } from "../profile/useProfile";
import { usePrediction } from "../predictions/usePrediction";
import { useSurveyResponse } from "../predictions/useSurveyResponse";
import { RankingList } from "../predictions/RankingList";
import { TEAMS, teamCrestSrc } from "../predictions/teams";
import { ParticipantPopup } from "../leaderboard/ParticipantPopup";
import { TeamPopup } from "../leaderboard/TeamPopup";
import type { RankedEntry } from "../leaderboard/ranking";
import { usePlayers } from "../profile/usePlayers";
import { useImagePreload } from "@/lib/useImagePreload";
import { compressImage, IMMUTABLE_CACHE_CONTROL } from "@/lib/compressImage";
import { WRITE_TIMEOUT_MS, withTimeout, writeErrorMessage } from "@/lib/withTimeout";
import { DISPLAY_NAME_MAX, isValidDisplayName } from "@/profile/profileTypes";
import { initials } from "../profile/deletedAccount";
import { ballKnowledgeLabel, deviceLabel, SUPPORT_NONE, SUPPORT_OTHER } from "@/predictions/surveyTypes";
import { countryName } from "@/data/countries";
import { clubName } from "@/data/clubs";
import { AWARDS, candidateName } from "@/data/awards";
import { predictionsAreOpen, formatDeadline } from "@/data/deadlines";
import { Frame, FrameHeader, FrameTitle, FrameBody } from "@/components/ui/frame";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageUnavailable } from "@/components/ui/page-unavailable";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/lib/useIsMobile";
import { useMobilePopups } from "../shell/MobilePopupHost";

// Same 1100px cap the rest of the site uses — this page isn't a wide data
// table, so it doesn't earn Home's 1400px exception.
const PAGE_SHELL =
  "relative mx-auto flex h-full min-h-0 w-full max-w-[1100px] min-w-0 flex-1 flex-col gap-3 p-3 sm:p-6 lg:gap-5 lg:p-6";
// Two columns: profile + quiz stacked on the left, the prediction (the
// heavier, 20-row-plus-8-awards content) taking the full row height on the
// right. Mobile stacks and divides a fixed screenful rather than letting the
// three blocks size to their content, which is what the flex ratios encode.
const MAIN_ROW =
  "relative z-10 flex min-h-0 min-w-0 flex-1 flex-col gap-3 lg:grid lg:h-full lg:gap-5 lg:grid-cols-[340px_1fr] [&>*]:min-h-0 [&>*]:min-w-0";
// `contents` on mobile: the wrapper exists to group profile+quiz into
// desktop's left column, but on a phone that grouping would force the pair to
// share one flex ratio against the prediction. Dissolving it makes all three
// direct children of MAIN_ROW, so each can take its own share.
const LEFT_COLUMN = "contents lg:flex lg:min-h-0 lg:flex-col lg:gap-5";

const TEAM_CREST_URLS = TEAMS.map((t) => teamCrestSrc(t.id));

function ProfileSkeleton() {
  return (
    <div className={PAGE_SHELL} aria-hidden data-testid="profile-skeleton">
      <div className={MAIN_ROW}>
        <div className={LEFT_COLUMN}>
          <Skeleton className="h-[180px] rounded-[var(--radius-4xl)]" />
          <Skeleton className="min-h-[140px] flex-1 rounded-[var(--radius-4xl)]" />
        </div>
        <Skeleton className="min-h-[300px] rounded-[var(--radius-4xl)]" />
      </div>
    </div>
  );
}

/** How the quiz's club answer reads back. Two of the three possible values
 *  aren't clubs at all. */
function clubAnswer(value: string): string {
  if (value === SUPPORT_OTHER) return "Another club";
  if (value === SUPPORT_NONE) return "No one in particular";
  return clubName(value);
}

export function ProfilePage() {
  const isMobile = useIsMobile();
  const mobilePopups = useMobilePopups();
  const { user, signOutNow } = useAuth();
  const navigate = useNavigate();
  const uid = user?.uid ?? null;

  const { data: profile, loading: profileLoading } = useProfile(uid);
  const { data: prediction, loading: predictionLoading } = usePrediction(uid);
  const { data: survey, loading: surveyLoading, error: surveyError } = useSurveyResponse(uid);
  const { players } = usePlayers();

  const imageUrls = useMemo(
    () => (profile?.photoURL ? [profile.photoURL, ...TEAM_CREST_URLS] : TEAM_CREST_URLS),
    [profile?.photoURL]
  );
  const imagesReady = useImagePreload(imageUrls);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoSaving, setPhotoSaving] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);


  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  const handlePopupOpenChange = useCallback((open: boolean) => {
    if (!open) setSelectedUid(null);
  }, []);
  const handleTeamPopupOpenChange = useCallback((open: boolean) => {
    if (!open) setSelectedTeamId(null);
  }, []);
  // On mobile these delegate to the shell's popup host rather than this
  // page's own popup state — the page's popups aren't rendered there (see the
  // guard below), so local state would open nothing.
  const handleSelectParticipant = useCallback(
    (participantUid: string) => {
      if (isMobile) return mobilePopups.openParticipant(participantUid);
      setSelectedUid(participantUid);
      setSelectedTeamId(null);
    },
    [isMobile, mobilePopups]
  );
  const handleSelectTeam = useCallback(
    (teamId: string) => {
      if (isMobile) return mobilePopups.openTeam(teamId);
      setSelectedTeamId(teamId);
      setSelectedUid(null);
    },
    [isMobile, mobilePopups]
  );

  if (!user) return <PageUnavailable />;
  if (profileLoading || predictionLoading || !imagesReady) return <ProfileSkeleton />;

  const predictionsOpen = predictionsAreOpen();

  const selectedPlayer = players.find((p) => p.uid === selectedUid) ?? null;
  const selectedRanked: RankedEntry | null = selectedPlayer
    ? {
        entry: {
          uid: selectedPlayer.uid,
          displayName: selectedPlayer.displayName,
          photoURL: selectedPlayer.photoURL,
          points: 0,
          ranking: [],
        },
        rank: 1,
      }
    : null;

  async function handlePhotoChange(file: File) {
    if (!uid) return;
    setPhotoSaving(true);
    setPhotoError(null);
    try {
      const compressed = await compressImage(file, { maxDimension: 256 });
      const fileRef = storageRef(storage, `profile-photos/${uid}-${Date.now()}`);
      await uploadBytes(fileRef, compressed, { cacheControl: IMMUTABLE_CACHE_CONTROL });
      const photoURL = await getDownloadURL(fileRef);
      await withTimeout(
        updateDoc(doc(db, "profiles", uid), { photoURL }),
        WRITE_TIMEOUT_MS,
        "Saving your photo"
      );
    } catch (err) {
      console.error("Failed to update profile photo", err);
      setPhotoError(writeErrorMessage(err));
    } finally {
      setPhotoSaving(false);
    }
  }

  async function handleSaveName() {
    if (!uid || !isValidDisplayName(nameDraft)) return;
    setNameSaving(true);
    setNameError(null);
    try {
      await withTimeout(
        updateDoc(doc(db, "profiles", uid), { displayName: nameDraft.trim() }),
        WRITE_TIMEOUT_MS,
        "Saving your name"
      );
      setEditingName(false);
    } catch (err) {
      console.error("Failed to update display name", err);
      setNameError(writeErrorMessage(err));
    } finally {
      setNameSaving(false);
    }
  }

  async function handleDeleteProfile() {
    if (!uid) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await Promise.all([
        deleteDoc(doc(db, "profiles", uid)),
        deleteDoc(doc(db, "predictions", uid)),
        deleteDoc(doc(db, "surveyResponses", uid)),
      ]);
      await signOutNow();
      setDeleteConfirmOpen(false);
      navigate("/");
    } catch (err) {
      console.error("Failed to delete profile", err);
      setDeleteError(writeErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  }


  return (
    <div className={PAGE_SHELL}>
      <div className={MAIN_ROW}>
        <div className={LEFT_COLUMN}>
          {/* Profile card — the participant's own blurred photo as a backdrop
              behind their avatar and name, the same treatment the participant
              popup's profile tab uses. Unlike the parent, the name IS
              editable: irishtable has one display name and no privacy split,
              so there is nothing that locking it protects. */}
          <Frame className="shrink-0 animate-cotton-rise lg:h-[180px]">
            <div className="relative flex min-h-0 flex-1 flex-col justify-between overflow-hidden px-4 py-3 sm:px-5">
              {profile?.photoURL && (
                <img
                  src={profile.photoURL}
                  alt=""
                  aria-hidden
                  className="absolute inset-0 -z-20 size-full scale-[5] object-cover blur-2xl brightness-50"
                />
              )}
              <div className="absolute inset-0 -z-10 bg-background/60" />

              <div className="flex items-start gap-3">
                <div className="relative shrink-0">
                  <Avatar size="lg" className="ring-2 ring-background">
                    <AvatarImage src={profile?.photoURL} alt="" />
                    <AvatarFallback className="bg-color_accent/20 font-mono text-sm text-color_text">
                      {initials(profile)}
                    </AvatarFallback>
                  </Avatar>
                  {/* The change-photo control sits as a badge on the photo's
                      own corner, matching the Avatar/AvatarBadge convention
                      rather than floating beside the name. Hidden entirely
                      when Storage isn't available — a picker that cannot
                      work is worse than no picker. */}
                  {photosEnabled && (
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        disabled={photoSaving}
                        className="sr-only"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void handlePhotoChange(file);
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        disabled={photoSaving}
                        onClick={() => fileInputRef.current?.click()}
                        aria-label={photoSaving ? "Uploading…" : "Change photo"}
                        className="absolute -right-1.5 -bottom-1.5 size-5 rounded-full border-2 border-background bg-card p-0 [&_svg]:size-2.5"
                      >
                        <CameraIcon />
                      </Button>
                    </>
                  )}
                  {photoError && (
                    <p
                      role="alert"
                      className="absolute top-full left-0 z-20 mt-1 w-max max-w-[140px] text-[0.6rem] text-color_remove"
                    >
                      {photoError}
                    </p>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  {editingName ? (
                    <div className="flex min-w-0 items-center gap-1.5">
                      <input
                        value={nameDraft}
                        autoFocus
                        maxLength={DISPLAY_NAME_MAX}
                        disabled={nameSaving}
                        aria-label="Display name"
                        onChange={(e) => setNameDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void handleSaveName();
                          if (e.key === "Escape") setEditingName(false);
                        }}
                        className="min-w-0 flex-1 rounded-lg border border-color_border1 bg-background px-2 py-1 font-display text-base text-color_text outline-none focus:border-color_accent"
                      />
                      <button
                        type="button"
                        aria-label="Save name"
                        disabled={nameSaving || !isValidDisplayName(nameDraft)}
                        onClick={() => void handleSaveName()}
                        className="flex shrink-0 cursor-pointer items-center justify-center rounded-full p-1 text-color_text transition-colors duration-150 hover:text-color_accent disabled:pointer-events-none disabled:opacity-30"
                      >
                        <Check className="size-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        aria-label="Cancel"
                        onClick={() => setEditingName(false)}
                        className="flex shrink-0 cursor-pointer items-center justify-center rounded-full p-1 text-color_textsecondary transition-colors duration-150 hover:text-color_text"
                      >
                        <X className="size-4" aria-hidden />
                      </button>
                    </div>
                  ) : (
                    <div className="flex min-w-0 items-center gap-1.5">
                      <p className="min-w-0 truncate font-display text-lg font-semibold tracking-[-0.01em] text-color_text">
                        {profile?.displayName}
                      </p>
                      <button
                        type="button"
                        aria-label="Edit name"
                        onClick={() => {
                          setNameDraft(profile?.displayName ?? "");
                          setNameError(null);
                          setEditingName(true);
                        }}
                        className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-color_border1/60 bg-color_secondary/80 text-color_textsecondary transition-all duration-150 ease-[var(--ease-cotton)] hover:border-color_accent hover:bg-hoverfill hover:text-color_accent"
                      >
                        <Pencil className="size-3.5" aria-hidden />
                      </button>
                    </div>
                  )}
                  {nameError && (
                    <p role="alert" className="mt-1 text-[0.7rem] text-color_remove">
                      {nameError}
                    </p>
                  )}
                </div>

                {/* Delete lives inside the profile block on mobile; desktop
                    keeps it as its own bottom-anchored column beside the
                    prediction frame. */}
                {isMobile && (
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError(null);
                      setDeleteConfirmOpen(true);
                    }}
                    aria-label="Delete profile"
                    className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-color_border1/70 text-color_remove outline-none transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-color_remove active:bg-color_remove/10"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>

              {/* The parent shows rank and points here. Nothing has been
                  played in irishtable, so every participant is level and a
                  rank would be noise — the deadline is the only status this
                  page can honestly report. */}
              <p className="pt-2 font-mono text-[0.62rem] tracking-[0.18em] text-color_textsecondary uppercase lg:pt-0">
                {predictionsOpen
                  ? `Entries close ${formatDeadline()}`
                  : "Entries are closed for this season"}
              </p>
            </div>
          </Frame>

          {/* Quiz answers — view-only, one-time (locked at sign-up). Same
              question/answer row treatment as ParticipantPopup's own quiz
              widget, so a participant sees their answers rendered identically
              wherever they show up. */}
          <Frame
            className="min-h-0 flex-[5] animate-cotton-rise lg:flex-1"
            style={{ animationDelay: "60ms" }}
          >
            <FrameHeader tone="navy">
              <FrameTitle className="text-color_text">Your answers</FrameTitle>
            </FrameHeader>
            <FrameBody className="min-h-0 flex-1">
              <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
                {survey ? (
                  <div className="flex flex-col gap-3">
                    {[
                      { question: "How old are you?", answer: String(survey.age) },
                      { question: "Where are you from?", answer: countryName(survey.country) },
                      {
                        question: "What team do you support?",
                        answer: clubAnswer(survey.clubSupported),
                      },
                      {
                        question: "How would you rate your ball knowledge?",
                        answer: ballKnowledgeLabel(survey.ballKnowledge),
                      },
                      {
                        question: "Which device will you mostly be using?",
                        answer: deviceLabel(survey.device),
                      },
                    ].map((row) => (
                      <div key={row.question}>
                        <p className="font-display text-sm leading-snug font-semibold text-color_text">
                          {row.question}
                        </p>
                        <p className="mt-0.5 font-display text-sm leading-snug font-light text-color_gold italic">
                          {row.answer}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : surveyError ? (
                  <p className="py-2 font-display text-sm text-color_textsecondary italic">
                    Your answers can't be shown right now.
                  </p>
                ) : !surveyLoading ? (
                  <p className="py-2 font-display text-sm text-color_textsecondary italic">
                    You haven't answered the questions yet.
                  </p>
                ) : null}
              </div>
            </FrameBody>
          </Frame>
        </div>

        {/* The prediction — view always, revise until the deadline. First
            submission still happens on /predictions, not here. The delete
            control rides alongside as a narrow column of its own, outside the
            Frame's box, bottom-anchored. */}
        <div className="flex min-h-0 min-w-0 flex-[8] gap-3 lg:flex-1">
          <Frame
            className="min-h-0 min-w-0 flex-1 animate-cotton-rise"
            style={{ animationDelay: "120ms" }}
          >
            <FrameHeader tone="navy">
              <FrameTitle className="text-color_text">Your prediction</FrameTitle>
              {prediction && predictionsOpen && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-color_border1 text-color_text hover:bg-color_border1/20"
                  onClick={() => navigate("/predictions")}
                >
                  Edit
                </Button>
              )}
            </FrameHeader>
            <FrameBody className="min-h-0 flex-1 px-4 py-3 sm:px-5">
              {prediction ? (
                <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
                  <RankingList ranking={prediction.table} onSelectTeam={handleSelectTeam} />
                  <div className="flex flex-col gap-1.5">
                    <span className="font-mono text-[0.62rem] tracking-[0.22em] text-color_textsecondary uppercase">
                      Cups and awards
                    </span>
                    {AWARDS.map((award) => (
                      <div
                        key={award.id}
                        className="flex items-center gap-3 rounded-lg border border-color_border1/50 bg-background px-4 py-2.5"
                      >
                        <span className="min-w-0 flex-1 truncate font-mono text-[0.62rem] tracking-[0.14em] text-color_textsecondary uppercase">
                          {award.label}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-right font-display text-sm text-color_text">
                          {prediction[award.id]
                            ? candidateName(award.id, prediction[award.id])
                            : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-start justify-center gap-3">
                  <p className="font-display text-sm text-color_textsecondary italic">
                    You haven't sent a prediction yet.
                  </p>
                  {predictionsOpen && (
                    <Link to="/predictions" className={cn(buttonVariants({ variant: "default" }))}>
                      Make your predictions
                    </Link>
                  )}
                </div>
              )}
            </FrameBody>
          </Frame>

          {!isMobile && (
            <div className="flex shrink-0 flex-col justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDeleteError(null);
                  setDeleteConfirmOpen(true);
                }}
                className="text-color_remove hover:text-color_remove"
              >
                Delete profile
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile uses the shell's popup host. Rendering these here too would
          give a phone two competing dialog layers. */}
      {!isMobile && (
        <>
          <ParticipantPopup
            ranked={selectedRanked}
            entries={[]}
            players={players}
            results={{}}
            onOpenChange={handlePopupOpenChange}
            onSelectTeam={handleSelectTeam}
            tournamentStarted={false}
          />
          <TeamPopup
            teamId={selectedTeamId}
            entries={[]}
            players={players}
            results={{}}
            onOpenChange={handleTeamPopupOpenChange}
            onSelectParticipant={handleSelectParticipant}
            tournamentStarted={false}
          />
        </>
      )}



      <Dialog
        open={deleteConfirmOpen}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setDeleteError(null);
            setDeleteConfirmOpen(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your profile?</DialogTitle>
            <DialogDescription>
              This permanently deletes your profile, your prediction and your answers, and
              signs you out. It cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p role="alert" className="text-sm text-color_remove">
              {deleteError}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={deleting}
              onClick={() => {
                setDeleteError(null);
                setDeleteConfirmOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={() => void handleDeleteProfile()}>
              {deleting ? "Deleting…" : "Yes, delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
