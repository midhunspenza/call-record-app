"use client";

import { ArrowDownLeft, ArrowUpRight, Info, PhoneOff, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatPhone } from "@/lib/phone";
import type { QosPathQuality, QosReport, QosStream } from "@/lib/qos";
import {
  CUSTOMER_LIMITS,
  RATING_PRESENTATION,
  VERDICT_PRESENTATION,
  customerFindings,
  distortionBand,
  duration,
  endedText,
  levelBand,
  lossBand,
  partyLabel,
  partyOf,
  pathPresentation,
  percent,
  referenceCode,
  scoreOutOfFive,
  seconds,
  type Tone,
} from "@/lib/qos-presentation";
import { TONE_STYLES, TonePill } from "./VerdictPill";
import { EXPLAINS, Explain } from "./Explain";

/**
 * The customer-facing call report.
 *
 * Every string a customer reads comes from qos-presentation.ts. Nothing here
 * renders the carrier's name, our infrastructure, internal identifiers, or the
 * engineering diagnostics — those remain on the report and in the API, they are
 * simply not shown. See that module's header for the full rule.
 */

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mb-7 last:mb-0">
      <h3 className="text-[13px] font-semibold text-[#111827] mb-0.5">{title}</h3>
      {hint ? <p className="text-[12.5px] text-[#6B7280] mb-3 max-w-[64ch]">{hint}</p> : null}
      {children}
    </section>
  );
}

function Metric({
  label,
  value,
  tone = "neutral",
  detail,
  explain,
}: {
  label: string;
  value: string;
  tone?: Tone;
  detail?: string;
  explain?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[11.5px] text-[#6B7280] mb-0.5 flex items-center gap-1">
        {label}
        {explain ? <Explain text={explain} /> : null}
      </div>
      <div className={cn("text-[14px] font-semibold tabular-nums", TONE_STYLES[tone].text)}>{value}</div>
      {detail ? <div className="text-[11px] text-[#9CA3AF] mt-0.5">{detail}</div> : null}
    </div>
  );
}

function AudioCard({ stream, direction }: { stream: QosStream; direction: QosReport["call"]["direction"] }) {
  const party = partyOf(stream.side, direction);
  const captured = stream.framesAnalyzed > 0;
  const level = levelBand(stream.levelDbfs.p50);
  const distortion = distortionBand(stream.clippingRatio);
  const dropouts = stream.gapCount;

  return (
    <div
      className={cn(
        "rounded-2xl border p-5",
        party === "yours" ? "border-[#1E63B5]/30 bg-[#1E63B5]/[0.03]" : "border-[#E5E7EB] bg-white",
      )}
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <span className="text-[14px] font-semibold text-[#111827]">
          Sent by {partyLabel(party).toLowerCase()}
        </span>
        {!captured ? (
          <TonePill tone="neutral">Not measured</TonePill>
        ) : stream.firstAudioMs === null ? (
          <TonePill tone="bad">Silent</TonePill>
        ) : null}
      </div>

      {!captured ? (
        <p className="text-[12.5px] text-[#6B7280]">
          Audio from this side was not captured, so nothing is claimed about it.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-x-5 gap-y-4">
          <Metric
            label="First audio heard"
            explain={EXPLAINS.firstAudioHeard}
            value={stream.firstAudioMs === null ? "None" : seconds(stream.firstAudioMs)}
            tone={stream.firstAudioMs === null ? "bad" : stream.firstAudioMs > 800 ? "warn" : "good"}
            detail="after the call connected"
          />
          <Metric label="Audio level"
            explain={EXPLAINS.audioLevel} value={level.label} tone={level.tone} />
          <Metric
            label="Dropouts"
            explain={EXPLAINS.dropouts}
            value={dropouts === 0 ? "None" : `${dropouts}`}
            tone={dropouts === 0 ? "good" : "warn"}
            detail={dropouts > 0 ? `longest ${seconds(stream.longestGapMs)}` : undefined}
          />
          <Metric label="Distortion"
            explain={EXPLAINS.distortion} value={distortion.label} tone={distortion.tone} />
        </div>
      )}
    </div>
  );
}

function QualityCard({ q, direction }: { q: QosPathQuality; direction: QosReport["call"]["direction"] }) {
  const p = pathPresentation(q.path, direction);
  const rating = q.rating;
  const band = rating ? RATING_PRESENTATION[rating.category] : null;
  const loss = lossBand(q.packetLossPercent);

  return (
    <div
      className={cn(
        "rounded-2xl border p-5",
        p.isYourExperience ? "border-[#1E63B5]/30 bg-[#1E63B5]/[0.03]" : "border-[#E5E7EB] bg-white",
      )}
    >
      <div className="flex items-start justify-between gap-4 mb-1">
        <span className="text-[14px] font-semibold text-[#111827]">{p.title}</span>
        {rating && band ? (
          <div className="text-right shrink-0">
            <div className={cn("text-[22px] font-bold leading-none tabular-nums", TONE_STYLES[band.tone].text)}>
              {scoreOutOfFive(rating)}
            </div>
            <div className="text-[10.5px] text-[#9CA3AF] mt-1 flex items-center gap-1 justify-end">
              out of 5
              <Explain text={EXPLAINS.qualityScore} />
            </div>
          </div>
        ) : null}
      </div>
      <p className="text-[12.5px] text-[#6B7280] mb-4 max-w-[46ch]">{p.meaning}</p>

      {rating && band ? (
        <div className="mb-4">
          <div className="h-2 rounded-full bg-[#F3F4F6] overflow-hidden">
            <div
              className={cn("h-full rounded-full", TONE_STYLES[band.tone].dot)}
              style={{ width: `${Math.max(3, (rating.mosCqe / 4.5) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between items-baseline mt-1.5">
            <span className={cn("text-[12px] font-semibold", TONE_STYLES[band.tone].text)}>{band.label}</span>
            <span className="text-[11px] text-[#9CA3AF]">measured throughout the call</span>
          </div>
        </div>
      ) : (
        <p className="text-[12.5px] text-[#9CA3AF] mb-4">
          The network did not report statistics for this direction.
        </p>
      )}

      <div className="grid grid-cols-2 gap-x-5 gap-y-4 pt-4 border-t border-[#E5E7EB]">
        <Metric
          label="Packet loss"
            explain={EXPLAINS.packetLoss}
          value={loss.label}
          tone={loss.tone}
          detail={q.packetLossPercent !== null ? percent(q.packetLossPercent) : undefined}
        />
        <Metric
          label="Jitter"
          explain={EXPLAINS.jitter}
          value={q.jitterMsMean === null ? "—" : seconds(q.jitterMsMean)}
          tone={q.jitterMsMean !== null && q.jitterMsMean > 30 ? "warn" : "good"}
          detail={q.jitterMsMax !== null ? `peak ${seconds(q.jitterMsMax)}` : undefined}
        />
      </div>
    </div>
  );
}

export function QosDetail({ report }: { report: QosReport }) {
  const v = VERDICT_PRESENTATION[report.verdict];
  const inbound = report.call.direction === "inbound";
  const Dir = inbound ? ArrowDownLeft : ArrowUpRight;

  const oneWayText =
    report.oneWayAudio === null
      ? null
      : (report.oneWayAudio === "caller_to_callee") === inbound
        ? "Only one side could be heard. The other party's audio never reached our network."
        : "Only one side could be heard. Your line's audio never reached our network.";

  // Derived here rather than taken from report.findings — those are written for
  // whoever is debugging the network, in our vocabulary, not the customer's.
  const observations = customerFindings(report);

  return (
    <div className="p-6 sm:p-7">
      <header className="mb-7">
        <TonePill tone={v.tone} className="mb-3">
          {v.label}
        </TonePill>

        <h2 className="text-[21px] font-bold text-[#111827] leading-tight tracking-tight max-w-[34ch]">
          {v.summary}
        </h2>

        <div className="flex items-center gap-2 mt-3 text-[13px] text-[#6B7280] flex-wrap">
          <Dir className="w-4 h-4 shrink-0" strokeWidth={2} />
          <span>
            {inbound ? "Incoming from" : "Outgoing to"}{" "}
            <span className="font-semibold text-[#111827]">
              {formatPhone(inbound ? report.call.callerNumber : report.call.calleeNumber)}
            </span>
          </span>
          <span className="text-[#D1D5DB]">·</span>
          <span>{new Date(report.call.startedAt).toLocaleString()}</span>
          <span className="text-[#D1D5DB]">·</span>
          <span>{duration(report.call.durationMs)}</span>
        </div>
      </header>

      {oneWayText ? (
        <div className="flex items-start gap-3 rounded-2xl bg-[#EF4444]/[0.06] border border-[#EF4444]/25 px-4 py-3.5 mb-7">
          <PhoneOff className="w-4 h-4 text-[#B91C1C] shrink-0 mt-0.5" strokeWidth={2} />
          <p className="text-[13px] text-[#B91C1C] leading-relaxed">{oneWayText}</p>
        </div>
      ) : null}

      {observations.length > 0 ? (
        <Section title="What we found">
          <ul className="flex flex-col gap-2.5">
            {observations.map((o, i) => (
              <li
                key={i}
                className={cn(
                  "rounded-xl border px-4 py-3 text-[13px] leading-relaxed",
                  o.tone === "bad"
                    ? "border-[#EF4444]/25 bg-[#EF4444]/[0.05] text-[#B91C1C]"
                    : "border-[#F59E0B]/30 bg-[#F59E0B]/[0.06] text-[#92400E]",
                )}
              >
                {o.text}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="Connecting the call">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 rounded-2xl border border-[#E5E7EB] bg-white p-5">
          <Metric
            label="Time to ring"
            explain={EXPLAINS.timeToRing}
            value={seconds(report.timing.signalingRingingMs)}
            tone={
              report.timing.signalingRingingMs !== null && report.timing.signalingRingingMs > 4000
                ? "warn"
                : "good"
            }
          />
          <Metric label="Time to answer"
            explain={EXPLAINS.timeToAnswer} value={seconds(report.timing.answerDelayMs)} />
          <Metric
            label="Answered"
            explain={EXPLAINS.answered}
            value={report.call.answered ? "Yes" : "No"}
            tone={report.call.answered ? "good" : "neutral"}
          />
          <Metric label="Call ended" explain={EXPLAINS.callEnded} value={endedText(report.call.hangupCause)} />
        </div>
      </Section>

      <Section
        title="What each side sent"
        hint="Measured from the audio itself, as it reached our network from each party."
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {report.audio.map((s) => (
            <AudioCard key={s.side} stream={s} direction={report.call.direction} />
          ))}
        </div>
      </Section>

      {report.quality.length > 0 ? (
        <Section
          title="Connection quality, each direction"
          hint="Each direction is measured separately, so a problem on one side is not hidden by a good result on the other. The highlighted card is what your line received."
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {report.quality.map((q) => (
              <QualityCard key={q.path} q={q} direction={report.call.direction} />
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="What this measurement covers">
        <div className="rounded-2xl border border-[#E5E7EB] bg-[#FDFCFB] p-5">
          <div className="flex items-start gap-3 mb-3">
            <ShieldCheck className="w-4 h-4 text-[#2FA36A] shrink-0 mt-0.5" strokeWidth={2} />
            <p className="text-[13px] text-[#111827] leading-relaxed">
              These figures come from measuring this call directly, not from a sample or an estimate.
            </p>
          </div>
          <ul className="flex flex-col gap-2 pl-7">
            {CUSTOMER_LIMITS.map((limit, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[12.5px] text-[#6B7280] leading-relaxed">
                <Info className="w-3.5 h-3.5 shrink-0 mt-[3px] text-[#9CA3AF]" strokeWidth={2} />
                <span>{limit}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <footer className="pt-4 border-t border-[#E5E7EB] text-[11.5px] text-[#9CA3AF]">
        Reference {referenceCode(report.reportId)}
      </footer>
    </div>
  );
}
