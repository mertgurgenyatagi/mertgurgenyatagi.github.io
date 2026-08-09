import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Plus } from "lucide-react";

interface PhotoStepProps {
  onSelect: (file: File) => void;
  /** Re-populates the picker when coming back to this step (via the signup
   *  flow's back button) after already choosing a photo — without it, going
   *  back here would show an empty picker with "continue" disabled even
   *  though a file was already chosen. */
  initialFile?: File | null;
  /** Photos are optional here, unlike the parent, because irishtable's
   *  Storage bucket needs a paid plan and may not exist. Skipping leaves the
   *  avatar on its initial, which is already the deleted-account treatment. */
  onSkip?: () => void;
}

export function PhotoStep({ onSelect, initialFile, onSkip }: PhotoStepProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(initialFile ?? null);
  const [preview, setPreview] = useState<string | null>(
    initialFile ? URL.createObjectURL(initialFile) : null
  );

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    if (!picked) return;
    setFile(picked);
    setPreview(URL.createObjectURL(picked));
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <p className="text-center font-display text-2xl font-light text-color_text">Pick a profile photo.</p>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label="Choose a profile photo"
        className="group flex size-28 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-color_secondary transition-colors duration-150 ease-[var(--ease-cotton)] hover:bg-color_text"
      >
        {preview ? (
          <img src={preview} alt="" className="size-full object-cover" />
        ) : (
          <Plus className="size-9 text-color_text group-hover:text-background" strokeWidth={2} aria-hidden />
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleChange}
        className="hidden"
        aria-hidden
        tabIndex={-1}
      />
      <button
        type="button"
        onClick={() => (file ? onSelect(file) : onSkip?.())}
        className="cursor-pointer rounded-full bg-color_text px-8 py-3.5 text-base font-semibold text-background transition-opacity"
      >
        {file ? "Continue" : "Skip for now"}
      </button>
    </div>
  );
}
