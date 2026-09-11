"use client";

import { useState } from "react";
import { ArrowDownLeft, FlaskConical, Gauge, MessageSquareQuote, ShieldCheck, Target } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { cn } from "@/lib/cn";
import { formatPhone } from "@/lib/phone";
import { duration } from "@/lib/qos-presentation";
import { TONE_STYLES } from "../qos/VerdictPill";
import { Explain } from "../qos/Explain";
import { AGENT_CALLS, type AgentCall } from "./data";
import {
  CapturedRow,
  MomentRow,
  RISK_PRESENTATION,
  ScoreRing,
  TraitBar,
  bandFor,
} from "./AgentPieces";

/**
 * Voice Agent Quality — design preview.
 *
 * Everything on this page is illustrative; see data.ts. The preview banner is
 * not decoration and should not be removed while the numbers are invented: this
 * console's credibility rests on the Call Quality screen's figures being real,
 * and unlabelled mock data sitting beside them would spend that credibility.
 */

const EXPLAIN = {
  overall: "A single figure combining responsiveness, tone, effectiveness and safety for this call. Useful for ranking calls; the four scores below are what you act on.",
  responsiveness: "How long the agent takes to start replying, and whether it stops talking when the caller interrupts. Long pauses and talking over people are the two things callers notice first.",
  tone: "How the agent came across, judged from the words and delivery: warm, respectful, helpful and clear. Scored per call, not per company.",
  effectiveness: "Whether the caller got what they rang for — questions answered, details captured correctly, and no unnecessary handover to a person.",
  safety: "Whether the call matches known fraud, phishing or abuse patterns. Flags for a human to review; nothing is blocked automatically.",
  firstResponse: "The gap between the call connecting and the agent starting to speak. Anything over a second reads as an awkward silence.",
  median: "The typical gap before the agent replies across the whole call. People expect roughly what another person would do.",
  bargeIn: "How often the agent stopped talking when the caller cut in. Failing to yield is the single most irritating agent behaviour.",
  captured: "Details the agent was meant to collect, and whether each was recorded correctly. Checked against what the caller actually said.",
};

function DimensionCard({
  icon: Icon,
  label,
  score,
  caption,
  explain,
  active,
}: {
  icon: typeof Gauge;
  label: string;
  score: number;
  caption: string;
  explain: string;
  active?: boolean;
}) {
  const band = bandFor(score);
  return (
    <div
      className={cn(
        "rounded-2xl border bg-white p-5",
        active ? "border-[#1E63B5]/30" : "border-[#E5E7EB]",
      )}
    >
      <div className="flex items-start gap-4">
        <ScoreRing score={score} size={64} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Icon className="w-4 h-4 text-[#9CA3AF]" strokeWidth={2} />
            <span className="text-[13px] font-semibold text-[#111827]">{label}</span>
            <Explain text={explain} />
          </div>
          <div className={cn("text-[12.5px] font-semibold mb-1", TONE_STYLES[band.tone].text)}>
            {band.label}
          </div>
          <p className="text-[12px] text-[#6B7280] leading-snug">{caption}</p>
        </div>
      </div>
    </div>
  );
}

function Detail({ call }: { call: AgentCall }) {
  const risk = RISK_PRESENTATION[call.risk.level];
  const RiskIcon = risk.icon;

  return (
    <div className="p-6 sm:p-7">
      <header className="mb-6">
        <div className="flex items-start justify-between gap-5 flex-wrap">
          <div>
            <h2 className="text-[19px] font-bold text-[#111827] tracking-tight">
              Call with {formatPhone(call.from)}
            </h2>
            <div className="flex items-center gap-2 mt-1.5 text-[13px] text-[#6B7280]">
              <ArrowDownLeft className="w-4 h-4" strokeWidth={2} />
              <span>{new Date(call.startedAt).toLocaleString()}</span>
              <span className="text-[#D1D5DB]">·</span>
              <span>{duration(call.durationMs)}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[11.5px] text-[#6B7280] flex items-center gap-1 justify-end">
                Overall <Explain text={EXPLAIN.overall} />
              </div>
              <div className={cn("text-[13px] font-semibold", TONE_STYLES[bandFor(call.overall).tone].text)}>
                {bandFor(call.overall).label}
              </div>
            </div>
            <ScoreRing score={call.overall} />
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-7">
        <DimensionCard
          icon={Gauge}
          label="Responsiveness"
          score={call.responsiveness.score}
          explain={EXPLAIN.responsiveness}
          caption={`Replies in ${call.responsiveness.medianResponseMs} ms typically, ${call.responsiveness.awkwardSilences} awkward silence${call.responsiveness.awkwardSilences === 1 ? "" : "s"}.`}
        />
        <DimensionCard
          icon={MessageSquareQuote}
          label="Tone"
          score={call.tone.score}
          explain={EXPLAIN.tone}
          caption={call.tone.label}
        />
        <DimensionCard
          icon={Target}
          label="Effectiveness"
          score={call.effectiveness.score}
          explain={EXPLAIN.effectiveness}
          caption={`${call.effectiveness.questionsResolved} of ${call.effectiveness.questionsAsked} questions resolved${call.effectiveness.escalated ? ", handed to a person" : ""}.`}
        />
        <DimensionCard
          icon={ShieldCheck}
          label="Safety"
          score={100 - call.risk.score}
          explain={EXPLAIN.safety}
          caption={risk.label}
        />
      </div>

      {/* Risk first when it matters — nobody wants it below the fold. */}
      {call.risk.level !== "clear" ? (
        <section className="mb-7">
          <div
            className={cn(
              "rounded-2xl border p-5",
              call.risk.level === "blocked"
                ? "border-[#EF4444]/30 bg-[#EF4444]/[0.04]"
                : "border-[#F59E0B]/35 bg-[#F59E0B]/[0.05]",
            )}
          >
            <div className="flex items-start gap-3 mb-3">
              <RiskIcon className={cn("w-5 h-5 shrink-0 mt-0.5", TONE_STYLES[risk.tone].text)} strokeWidth={2} />
              <div>
                <h3 className={cn("text-[14px] font-bold", TONE_STYLES[risk.tone].text)}>{risk.label}</h3>
                <p className="text-[13px] text-[#111827] mt-0.5 leading-relaxed">{risk.headline}</p>
              </div>
            </div>
            <ul className="flex flex-col gap-1.5 pl-8 mb-4">
              {call.risk.signals.map((sig, i) => (
                <li key={i} className="text-[12.5px] text-[#6B7280] leading-relaxed list-disc list-outside ml-4">
                  {sig}
                </li>
              ))}
            </ul>
            <div className="pl-8">
              <div className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide mb-1">
                Recommended action
              </div>
              <p className="text-[13px] text-[#111827] leading-relaxed">{call.risk.recommendation}</p>
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-7">
        <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
          <h3 className="text-[13px] font-semibold text-[#111827] mb-4">How it sounded</h3>
          <div className="flex flex-col gap-3.5">
            <TraitBar label="Warmth" value={call.tone.warmth} />
            <TraitBar label="Respect" value={call.tone.respect} />
            <TraitBar label="Helpfulness" value={call.tone.helpfulness} />
            <TraitBar label="Clarity" value={call.tone.clarity} />
          </div>
        </section>

        <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
          <h3 className="text-[13px] font-semibold text-[#111827] mb-4">Timing</h3>
          <div className="grid grid-cols-2 gap-x-5 gap-y-4">
            {[
              ["First reply", `${call.responsiveness.firstResponseMs} ms`, EXPLAIN.firstResponse],
              ["Typical reply", `${call.responsiveness.medianResponseMs} ms`, EXPLAIN.median],
              ["Slowest reply", `${call.responsiveness.slowestResponseMs} ms`, undefined],
              ["Yielded when interrupted", `${call.responsiveness.bargeInHandledPct}%`, EXPLAIN.bargeIn],
            ].map(([label, value, explain]) => (
              <div key={label as string}>
                <div className="text-[11.5px] text-[#6B7280] mb-0.5 flex items-center gap-1">
                  {label}
                  {explain ? <Explain text={explain as string} /> : null}
                </div>
                <div className="text-[14px] font-semibold text-[#111827] tabular-nums">{value}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mb-7">
        <h3 className="text-[13px] font-semibold text-[#111827] mb-0.5 flex items-center gap-1.5">
          Details captured <Explain text={EXPLAIN.captured} />
        </h3>
        <p className="text-[12.5px] text-[#6B7280] mb-3">{call.effectiveness.summary}</p>
        {call.effectiveness.captured.length > 0 ? (
          <ul className="rounded-2xl border border-[#E5E7EB] bg-white px-5 py-1">
            {call.effectiveness.captured.map((c) => (
              <CapturedRow key={c.field} item={c} />
            ))}
          </ul>
        ) : (
          <p className="text-[12.5px] text-[#9CA3AF]">No details were requested on this call.</p>
        )}
      </section>

      <section>
        <h3 className="text-[13px] font-semibold text-[#111827] mb-3">Moments worth hearing</h3>
        <ul className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
          {call.moments.map((m, i) => (
            <MomentRow key={i} moment={m} />
          ))}
        </ul>
      </section>
    </div>
  );
}

export default function AgentPage() {
  const [selectedId, setSelectedId] = useState(AGENT_CALLS[0]!.id);
  const selected = AGENT_CALLS.find((c) => c.id === selectedId)!;

  return (
    <AppShell crumb="Voice Agent">
      <div className="flex flex-col gap-5 max-w-[1400px]">
        <header>
          <h1 className="text-[26px] font-bold text-[#111827] leading-tight tracking-tight">
            Voice Agent Quality
          </h1>
          <div className="h-1 w-16 rounded-full bg-gradient-to-r from-[#2FA36A] to-[#1E63B5] mt-2.5 mb-2" />
          <p className="text-[13.5px] text-[#6B7280]">
            How well the agent itself handled each call — speed, tone, outcome and safety.
          </p>
        </header>

        {/* Unmissable, and staying until the numbers are real. */}
        <div className="flex items-start gap-3 rounded-2xl border border-[#1E63B5]/25 bg-[#1E63B5]/[0.04] px-5 py-4">
          <FlaskConical className="w-4 h-4 text-[#1E63B5] shrink-0 mt-0.5" strokeWidth={2} />
          <p className="text-[12.5px] text-[#111827] leading-relaxed max-w-[82ch]">
            <strong>Design preview — sample data.</strong> Nothing on this page is measured. It
            illustrates what agent evaluation would report once built. The Call Quality screen is
            live and its figures are real; these are not.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] gap-4 items-start">
          <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-sm lg:sticky lg:top-6">
            <div className="px-5 py-3.5 border-b border-[#E5E7EB]">
              <span className="text-[12px] font-semibold text-[#111827]">Agent calls</span>
            </div>
            <ul className="divide-y divide-[#E5E7EB]">
              {AGENT_CALLS.map((c) => {
                const active = c.id === selectedId;
                const band = bandFor(c.overall);
                const risk = RISK_PRESENTATION[c.risk.level];
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      aria-current={active}
                      className={cn(
                        "w-full text-left px-5 py-4 transition-colors duration-150",
                        "hover:bg-[#F9FAFB] focus-visible:outline-none focus-visible:bg-[#F9FAFB]",
                        "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1E63B5]/40",
                        active && "bg-[#1E63B5]/[0.05] hover:bg-[#1E63B5]/[0.05]",
                      )}
                    >
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <span className="text-[13.5px] font-semibold text-[#111827] truncate">
                          {formatPhone(c.from)}
                        </span>
                        <span className={cn("text-[15px] font-bold tabular-nums", TONE_STYLES[band.tone].text)}>
                          {c.overall}
                        </span>
                      </div>
                      <div className="text-[12px] text-[#9CA3AF] mb-1.5">
                        {new Date(c.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {" · "}
                        {duration(c.durationMs)}
                      </div>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 text-[11.5px] font-semibold",
                          TONE_STYLES[risk.tone].text,
                        )}
                      >
                        <span className={cn("w-1.5 h-1.5 rounded-full", TONE_STYLES[risk.tone].dot)} />
                        {c.risk.level === "clear" ? band.label : risk.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="bg-white border border-[#E5E7EB] rounded-2xl shadow-sm">
            <Detail call={selected} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
