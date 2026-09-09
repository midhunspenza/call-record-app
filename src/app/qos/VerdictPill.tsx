import { cn } from "@/lib/cn";
import { VERDICT_LABEL, type QosVerdict } from "@/lib/qos";

/**
 * Verdict is encoded in shape as well as colour — a dot plus a word — so the
 * state survives a greyscale print and a red/green colour deficiency.
 */
const STYLES: Record<QosVerdict, { chip: string; dot: string }> = {
  healthy: { chip: "bg-spenza-success-soft text-spenza-success", dot: "bg-spenza-success" },
  degraded: { chip: "bg-[#FFFBEB] text-[#B45309]", dot: "bg-spenza-amber" },
  failing: { chip: "bg-spenza-danger-soft text-spenza-danger", dot: "bg-spenza-danger" },
  insufficient_data: { chip: "bg-[#F5F5F5] text-spenza-slate", dot: "bg-spenza-mute" },
};

export function VerdictPill({
  verdict,
  className,
}: {
  verdict: QosVerdict;
  className?: string;
}) {
  const s = STYLES[verdict];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap",
        s.chip,
        className,
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", s.dot)} />
      {VERDICT_LABEL[verdict]}
    </span>
  );
}

export const VERDICT_STYLES = STYLES;
