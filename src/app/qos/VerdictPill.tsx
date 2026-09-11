import { cn } from "@/lib/cn";
import { VERDICT_PRESENTATION, type Tone } from "@/lib/qos-presentation";
import type { QosVerdict } from "@/lib/qos";

/**
 * Status is carried by a dot AND a word, so it survives greyscale printing and
 * red/green colour deficiency.
 *
 * Note the palette: semantic status uses green/amber/red, never the brand
 * orange. Orange is reserved for actions — a status chip is not an action, and
 * using the CTA colour for "degraded" would make a fault look clickable.
 */
export const TONE_STYLES: Record<Tone, { chip: string; dot: string; text: string }> = {
  good: { chip: "bg-[#22C55E]/10 text-[#15803D]", dot: "bg-[#22C55E]", text: "text-[#15803D]" },
  warn: { chip: "bg-[#F59E0B]/12 text-[#B45309]", dot: "bg-[#F59E0B]", text: "text-[#B45309]" },
  bad: { chip: "bg-[#EF4444]/10 text-[#B91C1C]", dot: "bg-[#EF4444]", text: "text-[#B91C1C]" },
  neutral: { chip: "bg-[#F3F4F6] text-[#6B7280]", dot: "bg-[#9CA3AF]", text: "text-[#6B7280]" },
};

export function TonePill({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  const s = TONE_STYLES[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold whitespace-nowrap",
        s.chip,
        className,
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", s.dot)} />
      {children}
    </span>
  );
}

export function VerdictPill({ verdict, className }: { verdict: QosVerdict; className?: string }) {
  const v = VERDICT_PRESENTATION[verdict];
  return (
    <TonePill tone={v.tone} className={className}>
      {v.label}
    </TonePill>
  );
}
