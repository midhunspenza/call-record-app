"use client";

import { AlertTriangle, Check, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Tone } from "@/lib/qos-presentation";
import { TONE_STYLES } from "../qos/VerdictPill";
import type { CapturedField, Moment, RiskLevel } from "./data";

/** Score bands shared across every dimension, so 78 means the same thing everywhere. */
export function bandFor(score: number): { label: string; tone: Tone } {
  if (score >= 85) return { label: "Excellent", tone: "good" };
  if (score >= 70) return { label: "Good", tone: "good" };
  if (score >= 55) return { label: "Needs work", tone: "warn" };
  return { label: "Poor", tone: "bad" };
}

/** Circular score, used once per dimension. Readable at a glance across a row. */
export function ScoreRing({ score, size = 76 }: { score: number; size?: number }) {
  const band = bandFor(score);
  const stroke = 6;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const colour =
    band.tone === "good" ? "#22C55E" : band.tone === "warn" ? "#F59E0B" : "#EF4444";

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F3F4F6" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={colour}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - score / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[19px] font-bold text-[#111827] tabular-nums">{score}</span>
      </div>
    </div>
  );
}

/** Horizontal trait bar — warmth, respect and so on. */
export function TraitBar({ label, value }: { label: string; value: number }) {
  const band = bandFor(value);
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[12.5px] text-[#6B7280]">{label}</span>
        <span className={cn("text-[12.5px] font-semibold tabular-nums", TONE_STYLES[band.tone].text)}>
          {value}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-[#F3F4F6] overflow-hidden">
        <div
          className={cn("h-full rounded-full", TONE_STYLES[band.tone].dot)}
          style={{ width: `${Math.max(2, value)}%` }}
        />
      </div>
    </div>
  );
}

export function CapturedRow({ item }: { item: CapturedField }) {
  return (
    <li className="flex items-center gap-3 py-2 border-b border-[#E5E7EB] last:border-b-0">
      <span
        className={cn(
          "w-5 h-5 rounded-full flex items-center justify-center shrink-0",
          item.ok ? "bg-[#22C55E]/12" : "bg-[#EF4444]/12",
        )}
      >
        {item.ok ? (
          <Check className="w-3 h-3 text-[#15803D]" strokeWidth={3} />
        ) : (
          <X className="w-3 h-3 text-[#B91C1C]" strokeWidth={3} />
        )}
      </span>
      <span className="text-[12.5px] text-[#6B7280] w-[130px] shrink-0">{item.field}</span>
      <span
        className={cn(
          "text-[13px] truncate",
          item.ok ? "text-[#111827] font-medium" : "text-[#B91C1C]",
        )}
      >
        {item.value}
      </span>
    </li>
  );
}

export const RISK_PRESENTATION: Record<
  RiskLevel,
  { label: string; tone: Tone; icon: typeof ShieldCheck; headline: string }
> = {
  clear: {
    label: "No concerns",
    tone: "good",
    icon: ShieldCheck,
    headline: "Nothing in this call matched a known fraud or abuse pattern.",
  },
  review: {
    label: "Flagged for review",
    tone: "warn",
    icon: AlertTriangle,
    headline: "This call shows signs worth a human look before any action is taken.",
  },
  blocked: {
    label: "Flagged — high risk",
    tone: "bad",
    icon: ShieldAlert,
    headline: "This call matches established fraud patterns and has been flagged.",
  },
};

/** One line of the conversation, with the agent's reply latency where relevant. */
export function MomentRow({ moment }: { moment: Moment }) {
  const isAgent = moment.speaker === "agent";
  const flagTone: Tone =
    moment.flag === "good" ? "good" : moment.flag === "warn" ? "warn" : moment.flag === "bad" ? "bad" : "neutral";

  return (
    <li className="flex gap-3">
      <div className="w-[54px] shrink-0 text-right pt-0.5">
        <span className="text-[11px] text-[#9CA3AF] tabular-nums">
          {(moment.atMs / 1000).toFixed(1)}s
        </span>
      </div>

      <div className="min-w-0 flex-1 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <span
            className={cn(
              "text-[11px] font-semibold px-2 py-0.5 rounded-full",
              isAgent ? "bg-[#1E63B5]/10 text-[#1E63B5]" : "bg-[#F3F4F6] text-[#6B7280]",
            )}
          >
            {isAgent ? "Agent" : "Caller"}
          </span>
          {moment.responseMs !== undefined ? (
            <span
              className={cn(
                "text-[11px] tabular-nums font-medium",
                moment.responseMs > 1500
                  ? TONE_STYLES.bad.text
                  : moment.responseMs > 1000
                    ? TONE_STYLES.warn.text
                    : TONE_STYLES.good.text,
              )}
            >
              replied in {moment.responseMs} ms
            </span>
          ) : null}
        </div>

        <p className="text-[13.5px] text-[#111827] leading-relaxed">{moment.text}</p>

        {moment.note ? (
          <p className={cn("text-[12px] mt-1.5 leading-relaxed", TONE_STYLES[flagTone].text)}>
            {moment.note}
          </p>
        ) : null}
      </div>
    </li>
  );
}
