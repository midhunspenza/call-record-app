"use client";

import { useId, useState } from "react";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * "How is this calculated?" for a single metric.
 *
 * Opens on hover and on keyboard focus, and is wired with aria-describedby so a
 * screen reader gets the explanation too — a tooltip that only exists on hover
 * is decoration, not documentation.
 *
 * Copy lives in EXPLANATIONS below so every definition sits in one place and
 * can be reviewed as a set rather than hunted through components.
 */
export function Explain({ text, className }: { text: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span className={cn("relative inline-flex align-middle", className)}>
      <button
        type="button"
        aria-label="How this is calculated"
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        // Open, never toggle. Focus fires before click, so a toggle here would
        // open on focus and immediately close again on the same interaction —
        // which is exactly what it did, leaving the tooltip unreachable by
        // mouse click and by tap. Blur and mouse-leave do the closing.
        onClick={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
        className="text-[#9CA3AF] hover:text-[#1E63B5] focus-visible:text-[#1E63B5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E63B5]/30 rounded-full transition-colors"
      >
        <HelpCircle className="w-3.5 h-3.5" strokeWidth={2} />
      </button>

      {open ? (
        <span
          id={id}
          role="tooltip"
          className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-30 w-[248px] rounded-xl bg-[#111827] text-white text-[12px] leading-relaxed px-3.5 py-2.5 shadow-xl pointer-events-none"
        >
          {text}
          <span className="absolute left-1/2 -translate-x-1/2 top-full -mt-1 w-2 h-2 rotate-45 bg-[#111827]" />
        </span>
      ) : null}
    </span>
  );
}

/**
 * Executive-level definitions: what the number means and where it comes from,
 * in a sentence or two. No units nobody uses, no internal vocabulary.
 */
export const EXPLAINS = {
  callsMeasured:
    "How many of your recent calls we have quality data for. Every call on a monitored number is measured — none are sampled or skipped.",
  qualityOnYourLine:
    "The average quality your own side received, across these calls. We score each direction separately and average only the one your line heard.",
  callsWithoutIssues:
    "How many calls had no detectable fault. Shown as a count rather than a percentage, because a percentage on a handful of calls claims more than the data supports.",
  typicalTimeToRing:
    "The middle value of how long calls took to start ringing. We use the middle rather than the average so one unusual call doesn't skew it.",

  timeToRing:
    "From dialling until the network signals that the far end is ringing. This is the network's signal — it does not confirm the exact moment a handset rang.",
  timeToAnswer:
    "From the start of ringing until the call was picked up. This is mostly human behaviour, not a measure of network performance.",
  answered:
    "Whether the call was picked up. If it was not, audio quality cannot be assessed at all.",
  callEnded:
    "Why the call finished, taken from the network's own reason code. 'Ended normally' means someone simply hung up.",

  firstAudioHeard:
    "How long after connecting before the first audible speech from that side. A short delay is normal — people pause before speaking.",
  audioLevel:
    "How loud that side was, judged over the moments they were actually speaking rather than across the whole call. 'Normal' is the range a phone call should sit in.",
  dropouts:
    "Times the audio vanished mid-sentence while nobody else was talking, and the network confirmed packets were lost. Ordinary pauses in conversation are not counted.",
  distortion:
    "How often the audio was too loud for the line to carry, flattening the peaks. This happens before the audio reaches us, usually from a microphone or gain setting.",

  qualityScore:
    "A quality rating out of 5 for this one direction, calculated from packet loss, jitter and delay using the international standard for voice quality. It tops out at 4.5 — the model does not treat a phone line as capable of perfection.",
  packetLoss:
    "How much of the audio never arrived. Voice calls cannot conceal missing audio, so even a small amount is audible.",
  jitter:
    "How unevenly the audio arrived. Small amounts are smoothed out automatically; large amounts turn into audible breaks.",
} as const;
