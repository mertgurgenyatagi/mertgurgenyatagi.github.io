import { motion } from "motion/react";
import { Check } from "lucide-react";

/** The "You're in." / "All set." moment — same symbol both times, per
 *  Mert's brief, just different text. A light spring overshoot, tuned down
 *  ("don't overdo the bounce") rather than a cartoonish boing. Hand-built
 *  for now — swappable for a sourced animation asset later without touching
 *  anything that calls this component. */
export function BounceCheck({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-6">
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 16, mass: 0.7 }}
        className="flex size-20 items-center justify-center rounded-full bg-color_text"
      >
        <Check className="size-10 text-background" strokeWidth={3} />
      </motion.div>
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.3, ease: "easeOut" }}
        className="text-center font-display text-2xl font-light text-color_text"
      >
        {text}
      </motion.p>
    </div>
  );
}
