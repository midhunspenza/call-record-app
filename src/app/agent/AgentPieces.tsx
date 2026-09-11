"use client";

import { AlertTriangle, Check, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Tone } from "@/lib/qos-presentation";
import { TONE_STYLES } from "../qos/VerdictPill";
import { Explain } from "../qos/Explain";
import type { CapturedField, Moment, RiskLevel, SentimentPoint, SentimentState } from "./data";

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

/* ------------------------------------------------------------------ *
 * Sentiment trajectory
 * ------------------------------------------------------------------ */

export const SENTIMENT: Record<SentimentState, { label: string; colour: string; tone: Tone }> = {
  positive: { label: "Positive", colour: "#22C55E", tone: "good" },
  neutral: { label: "Neutral", colour: "#9CA3AF", tone: "neutral" },
  frustrated: { label: "Frustrated", colour: "#F59E0B", tone: "warn" },
  angry: { label: "Angry", colour: "#EF4444", tone: "bad" },
};

/**
 * The caller's mood across the call, as a band rather than a number.
 *
 * The shape is the point: where it changed matters far more than the average.
 * Segments below 60% confidence are drawn faded and hatched, because asserting
 * a mood the classifier was unsure about is how this kind of feature loses
 * people's trust.
 */
export function SentimentTrack({
  track,
  durationMs,
  turningPointMs,
}: {
  track: SentimentPoint[];
  durationMs: number;
  turningPointMs: number | null;
}) {
  const segments = track.map((p, i) => {
    const next = track[i + 1];
    const endMs = next ? next.atMs : durationMs;
    return { ...p, widthPct: Math.max(1, ((endMs - p.atMs) / durationMs) * 100) };
  });

  return (
    <div>
      <div className="relative h-8 rounded-lg overflow-hidden flex">
        {segments.map((seg, i) => {
          const s = SENTIMENT[seg.state];
          const unsure = seg.confidence < 0.6;
          return (
            <div
              key={i}
              className="h-full relative"
              style={{
                width: `${seg.widthPct}%`,
                backgroundColor: s.colour,
                opacity: unsure ? 0.4 : 1,
              }}
              title={`${s.label} — ${Math.round(seg.confidence * 100)}% confident`}
            >
              {unsure ? (
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(45deg, rgba(255,255,255,.55) 0 3px, transparent 3px 6px)",
                  }}
                />
              ) : null}
            </div>
          );
        })}

        {turningPointMs !== null ? (
          <div
            className="absolute top-0 bottom-0 w-[2px] bg-[#111827]"
            style={{ left: `${(turningPointMs / durationMs) * 100}%` }}
          >
            <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#111827]" />
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between mt-2 text-[11px] text-[#9CA3AF]">
        <span>Call start</span>
        {turningPointMs !== null ? (
          <span className="text-[#111827] font-semibold">
            turned at {(turningPointMs / 1000).toFixed(1)}s
          </span>
        ) : null}
        <span>Call end</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3">
        {(Object.keys(SENTIMENT) as SentimentState[]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5 text-[11px] text-[#6B7280]">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: SENTIMENT[k].colour }} />
            {SENTIMENT[k].label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 text-[11px] text-[#9CA3AF]">
          <span
            className="w-2.5 h-2.5 rounded-sm bg-[#9CA3AF]"
            style={{
              opacity: 0.4,
              backgroundImage:
                "repeating-linear-gradient(45deg, rgba(255,255,255,.55) 0 3px, transparent 3px 6px)",
            }}
          />
          Low confidence
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Caller effort — counted, not inferred
 * ------------------------------------------------------------------ */

export function EffortStat({
  label,
  count,
  goodWhenZero = true,
  explain,
}: {
  label: string;
  count: number;
  goodWhenZero?: boolean;
  explain?: string;
}) {
  const tone: Tone = !goodWhenZero ? "neutral" : count === 0 ? "good" : count <= 2 ? "warn" : "bad";
  return (
    <div>
      <div className="text-[11.5px] text-[#6B7280] mb-0.5 flex items-center gap-1">
        {label}
        {explain ? <Explain text={explain} /> : null}
      </div>
      <div className={cn("text-[18px] font-bold tabular-nums", TONE_STYLES[tone].text)}>{count}</div>
    </div>
  );
}
