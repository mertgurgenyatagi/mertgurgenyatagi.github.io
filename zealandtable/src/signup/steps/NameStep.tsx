import { useState, type FormEvent } from "react";
import { DISPLAY_NAME_MAX, isValidDisplayName } from "@/profile/profileTypes";

interface NameStepProps {
  onSubmit: (displayName: string) => void;
  disabled?: boolean;
  initialDisplayName?: string;
}

/**
 * One field, not the parent's locked first + last pair.
 *
 * The parent splits the name so it can show a surname to signed-in
 * participants and hide it from the public; irishtable's audience *is* the
 * public, which makes surname exposure worse rather than better, and nothing
 * here needs a legal name. `DISPLAY_NAME_MAX` matches the cap enforced
 * server-side in firestore.rules.
 */
export function NameStep({ onSubmit, disabled, initialDisplayName }: NameStepProps) {
  const [displayName, setDisplayName] = useState(initialDisplayName ?? "");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!isValidDisplayName(displayName)) return;
    onSubmit(displayName.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-center gap-5">
      <p className="max-w-lg text-balance text-center font-display text-2xl font-light text-color_text">
        What should we call you?
      </p>
      {/* Text inputs keep the native I-beam — the "no I-beam anywhere" rule
          applies to clickable controls, not to actual text entry. */}
      <input
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        placeholder="Your name"
        aria-label="Display name"
        required
        maxLength={DISPLAY_NAME_MAX}
        disabled={disabled}
        className="w-72 rounded-full border border-color_text/45 bg-background px-6 py-4 text-center text-base font-light text-color_text placeholder:text-color_text/40 outline-none transition-colors duration-150 ease-[var(--ease-cotton)] focus:border-color_accent"
      />
      <p className="font-mono text-[0.62rem] tracking-[0.14em] text-color_textsecondary uppercase tnum">
        {displayName.length}/{DISPLAY_NAME_MAX}
      </p>
      <button
        type="submit"
        disabled={disabled || !isValidDisplayName(displayName)}
        className="mt-2 cursor-pointer rounded-full bg-color_text px-8 py-4 text-base font-semibold text-background transition-opacity disabled:cursor-default disabled:opacity-40"
      >
        {disabled ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
