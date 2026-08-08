import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft } from "lucide-react";
import { doc, setDoc } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, photosEnabled, storage } from "@/firebase";
import { compressImage, IMMUTABLE_CACHE_CONTROL } from "@/lib/compressImage";
import { WRITE_TIMEOUT_MS, withTimeout, writeErrorMessage } from "@/lib/withTimeout";
import { saveSurveyResponse } from "@/predictions/useSurveyResponse";
import {
  AGE_MAX,
  AGE_MIN,
  BALL_KNOWLEDGE_OPTIONS,
  DEVICE_OPTIONS,
  type BallKnowledge,
  type Device,
} from "@/predictions/surveyTypes";
import { AutoAdvance } from "./AutoAdvance";
import { WelcomeStep } from "./steps/WelcomeStep";
import { PhotoStep } from "./steps/PhotoStep";
import { NameStep } from "./steps/NameStep";
import { AgeRollerStep } from "./steps/AgeRollerStep";
import { CountryStep } from "./steps/CountryStep";
import { ClubStep } from "./steps/ClubStep";
import { ChoiceStep } from "./ChoiceStep";
import { BounceCheck } from "./BounceCheck";
import { welcomeVariants, sharpVariants } from "./transitions";

type StepId =
  | "welcome"
  | "photo"
  | "name"
  | "bounce-profile"
  | "quiz-age"
  | "quiz-country"
  | "quiz-club"
  | "quiz-knowledge"
  | "quiz-device"
  | "bounce-survey";

/** Profile photos need a paid Storage plan, so when uploads are off the step
 *  drops out of the order entirely rather than rendering a picker that can't
 *  work — and out of the progress denominator with it, otherwise the bar
 *  would never reach the end. */
function buildOrder(): StepId[] {
  const rest: StepId[] = [
    "name",
    "bounce-profile",
    "quiz-age",
    "quiz-country",
    "quiz-club",
    "quiz-knowledge",
    "quiz-device",
    "bounce-survey",
  ];
  return photosEnabled ? ["welcome", "photo", ...rest] : ["welcome", ...rest];
}

const AGE_DEFAULT = 24;

interface SignupFlowProps {
  uid: string;
  /** Someone who already has a profile but no quiz answers (they closed the
   *  tab mid-quiz) rejoins at the quiz rather than re-doing their name. */
  hasProfile?: boolean;
  onDone: () => void;
}

/**
 * The full post-signup sequence: welcome → photo → name → "you're in" bounce
 * → five-question quiz → "all set" bounce → onDone (ProfileGate then renders
 * the real app). One continuous animated overlay, not a page navigation.
 *
 * Cloned from kupatakipucl. Two differences, both forced by data rather than
 * taste: one `displayName` instead of the locked first + last pair, and a
 * country question the parent never needed. The quiz set is otherwise
 * irishtable's own — the parent's Messi/Ronaldo and Süper Lig questions do
 * not travel.
 *
 * Within a single attempt every answerable step has a way back — a
 * fat-fingered age or a second-guessed club pick shouldn't mean starting the
 * whole flow over. "welcome" and both "bounce-*" checkmark screens are
 * transient and auto-advancing, not something to land on deliberately, so
 * goBack() steps over them.
 */
export function SignupFlow({ uid, hasProfile = false, onDone }: SignupFlowProps) {
  const order = buildOrder();
  const [index, setIndex] = useState(() => {
    if (!hasProfile) return 0;
    const resume = order.indexOf("quiz-age");
    return resume === -1 ? 0 : resume;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [age, setAge] = useState(AGE_DEFAULT);
  const [country, setCountry] = useState<string | null>(null);
  const [clubSupported, setClubSupported] = useState<string | null>(null);
  const [ballKnowledge, setBallKnowledge] = useState<BallKnowledge | null>(null);

  const step = order[index];

  const advance = useCallback(() => setIndex((i) => i + 1), []);

  // Bounce screens auto-advance forward on their own and were never meant to
  // be landed on deliberately, so stepping back skips over them too — one
  // press of "back" always lands on the previous *answerable* step.
  function goBack() {
    setIndex((i) => {
      let next = i - 1;
      while (next > 0 && order[next].startsWith("bounce-")) next--;
      return Math.max(next, 0);
    });
  }

  const BACK_HIDDEN: StepId[] = ["welcome", "photo", "bounce-profile", "bounce-survey"];
  // With no profile step behind it, the quiz's first question has nowhere to
  // go back to on a resumed flow either.
  const showBack = !BACK_HIDDEN.includes(step) && index > 0;

  /**
   * First write: create the profile, with a photo if one was picked and the
   * upload works.
   *
   * The photo upload is deliberately non-fatal. Firebase Storage needs a paid
   * plan, so on a free-tier project it fails outright — and a signup flow
   * that dead-ends on an optional avatar would block every single person from
   * joining. A missing photo just falls back to an initial, which is already
   * the deleted-account treatment.
   */
  async function handleNameSubmit(submitted: string) {
    if (saving) return;
    setSaving(true);
    setError(null);
    setDisplayName(submitted);

    let photoURL = "";
    if (photosEnabled && photoFile) {
      try {
        const compressed = await compressImage(photoFile, { maxDimension: 256 });
        // Fresh timestamped path per upload, so an immutable cache header is
        // always safe: a cached URL is either current or an orphan, never stale.
        const fileRef = storageRef(storage, `profile-photos/${uid}-${Date.now()}`);
        await uploadBytes(fileRef, compressed, { cacheControl: IMMUTABLE_CACHE_CONTROL });
        photoURL = await getDownloadURL(fileRef);
      } catch (err) {
        console.warn("Photo upload failed; continuing without one.", err);
      }
    }

    try {
      await withTimeout(
        setDoc(doc(db, "profiles", uid), {
          displayName: submitted,
          photoURL,
          createdAt: Date.now(),
        }),
        WRITE_TIMEOUT_MS,
        "Saving your profile"
      );
      setSaving(false);
      advance();
    } catch (err) {
      console.error("Signup profile save failed", err);
      setSaving(false);
      setError(writeErrorMessage(err));
    }
  }

  /** Second write: the quiz. Fires the moment a device is chosen. */
  async function handleDeviceSelect(device: Device) {
    if (saving || !country || !clubSupported || ballKnowledge === null) return;
    setSaving(true);
    setError(null);
    try {
      await withTimeout(
        saveSurveyResponse(uid, { age, country, clubSupported, ballKnowledge, device }),
        WRITE_TIMEOUT_MS,
        "Saving your answers"
      );
      setSaving(false);
      advance();
    } catch (err) {
      console.error("Signup survey save failed", err);
      setSaving(false);
      setError(writeErrorMessage(err));
    }
  }

  if (!step) return null;

  const variants = step === "welcome" ? welcomeVariants : sharpVariants;

  return (
    // h-dvh, not h-full — this renders outside AppShell (ProfileGate sits
    // above it, see App.tsx), so there's no ancestor guaranteed to carry a
    // resolved height down through a plain %-chain. AppShell.tsx uses the
    // same dvh unit for exactly this reason.
    <div className="relative flex h-dvh w-full cursor-default items-center justify-center overflow-hidden bg-background px-6 py-10">
      {/* Always mounted (outside AnimatePresence's per-step swap) so it
          persists across every step, just changing width — a minimal,
          constant sense of progress rather than something that resets or
          flickers between steps. */}
      <div
        aria-hidden
        className="absolute top-10 left-1/2 h-1 w-64 -translate-x-1/2 overflow-hidden rounded-full bg-color_text/10"
      >
        <div
          className="h-full rounded-full bg-color_text transition-[width] duration-500 ease-[var(--ease-cotton)]"
          style={{ width: `${((index + 1) / order.length) * 100}%` }}
        />
      </div>
      {showBack && (
        <button
          type="button"
          onClick={goBack}
          aria-label="Back"
          className="absolute top-8 left-6 flex cursor-pointer items-center justify-center rounded-full p-2 text-color_text transition-colors duration-150 ease-[var(--ease-cotton)] hover:bg-color_text hover:text-background sm:top-10 sm:left-8"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
      )}
      <AnimatePresence mode="wait">
        {/* max-h + overflow-y-auto is the actual bound — the outer h-dvh
            clips, it doesn't shrink content to fit. Shrinks to natural
            content size when that fits; only engages as a scroll fallback
            when it doesn't. */}
        <motion.div
          key={step}
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="no-scrollbar flex max-h-[calc(100dvh-5rem)] w-full flex-col items-center overflow-y-auto"
        >
          {step === "welcome" && (
            <AutoAdvance delayMs={2600} onDone={advance}>
              <WelcomeStep />
            </AutoAdvance>
          )}

          {step === "photo" && (
            <PhotoStep
              initialFile={photoFile}
              onSelect={(file) => {
                setPhotoFile(file);
                advance();
              }}
              onSkip={advance}
            />
          )}

          {step === "name" && (
            <NameStep
              onSubmit={handleNameSubmit}
              disabled={saving}
              initialDisplayName={displayName}
            />
          )}

          {step === "bounce-profile" && (
            <AutoAdvance delayMs={2000} onDone={advance}>
              <BounceCheck text="You’re in. Five quick questions." />
            </AutoAdvance>
          )}

          {step === "quiz-age" && (
            <AgeRollerStep
              min={AGE_MIN}
              max={AGE_MAX}
              defaultValue={age}
              onConfirm={(value) => {
                setAge(value);
                advance();
              }}
            />
          )}

          {step === "quiz-country" && (
            <CountryStep
              initialSelection={country}
              onSelect={(code) => {
                setCountry(code);
                advance();
              }}
            />
          )}

          {step === "quiz-club" && (
            <ClubStep
              initialSelection={clubSupported}
              onSelect={(selection) => {
                setClubSupported(selection);
                advance();
              }}
            />
          )}

          {step === "quiz-knowledge" && (
            <ChoiceStep
              question="How would you rate your ball knowledge?"
              options={BALL_KNOWLEDGE_OPTIONS.map((o) => ({
                value: String(o.value),
                label: o.label,
              }))}
              initialValue={ballKnowledge !== null ? String(ballKnowledge) : null}
              onSelect={(value) => {
                setBallKnowledge(Number(value) as BallKnowledge);
                advance();
              }}
            />
          )}

          {step === "quiz-device" && (
            <ChoiceStep
              question="Which device will you mostly be using?"
              options={DEVICE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              disabled={saving}
              onSelect={(value) => handleDeviceSelect(value as Device)}
            />
          )}

          {step === "bounce-survey" && (
            <AutoAdvance delayMs={2000} onDone={onDone}>
              <BounceCheck text="All set. Your table is waiting." />
            </AutoAdvance>
          )}
        </motion.div>
      </AnimatePresence>

      {error && (
        <p
          role="alert"
          className="absolute bottom-8 rounded-md border border-color_remove/40 bg-color_remove/10 px-3 py-2 text-sm text-color_remove"
        >
          {error}
        </p>
      )}
    </div>
  );
}
