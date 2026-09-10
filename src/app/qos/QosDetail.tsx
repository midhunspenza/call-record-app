"use client";

import { AlertTriangle, CircleAlert, Info, ShieldQuestion } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatPhone } from "@/lib/phone";
import {
  PATH_EXPERIENCED_BY,
  PATH_LABEL,
  RATING_LABEL,
  fmtDbfs,
  fmtMs,
  fmtPct,
  sideLabel,
  type QosFinding,
  type QosPathQuality,
  type QosReport,
  type QosStream,
} from "@/lib/qos";
import { VerdictPill } from "./VerdictPill";

/** Map dBFS onto a 0–1 bar. -90 is silence, 0 is full scale. */
function levelFraction(dbfs: number): number {
  return Math.min(1, Math.max(0, (dbfs + 90) / 90));
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b border-spenza-border last:border-b-0">
      <div className="min-w-0">
        <div className="text-[13px] text-spenza-slate">{label}</div>
        {hint ? <div className="text-[11.5px] text-spenza-mute leading-snug mt-0.5">{hint}</div> : null}
      </div>
      <div className="text-[13px] font-medium text-spenza-ink font-mono tabular-nums shrink-0">
        {value}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h3
        className="text-[10px] font-semibold uppercase text-spenza-mute mb-2"
        style={{ letterSpacing: "0.16em" }}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

function FindingRow({ finding }: { finding: QosFinding }) {
  const Icon =
    finding.severity === "critical"
      ? CircleAlert
      : finding.severity === "warn"
        ? AlertTriangle
        : Info;
  const tone =
    finding.severity === "critical"
      ? "bg-spenza-danger-soft text-spenza-danger border-[#FCA5A5]"
      : finding.severity === "warn"
        ? "bg-[#FFFBEB] text-[#B45309] border-[#FCD34D]"
        : "bg-spenza-canvas text-spenza-slate border-spenza-border";

  return (
    <li className={cn("flex items-start gap-2.5 border rounded-input px-3 py-2.5", tone)}>
      <Icon className="w-4 h-4 shrink-0 mt-[1px]" strokeWidth={2} />
      <div className="min-w-0">
        <p className="text-[13px] leading-relaxed">{finding.message}</p>
        <p className="text-[11px] font-mono opacity-70 mt-0.5">{finding.code}</p>
      </div>
    </li>
  );
}

function StreamCard({ stream }: { stream: QosStream }) {
  const silent = stream.firstAudioMs === null;
  return (
    <div className="border border-spenza-border rounded-input p-3.5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="text-[13px] font-semibold text-spenza-ink">{sideLabel(stream.side)}</span>
        {silent ? (
          <span className="text-[11px] font-semibold text-spenza-danger">No audible audio</span>
        ) : (
          <span className="text-[11px] font-mono text-spenza-slate">
            first audio {fmtMs(stream.firstAudioMs)}
          </span>
        )}
      </div>

      {/* Level meter: p05 → p95 span with the median marked. A single average
          would hide the difference between "quiet throughout" and "swinging". */}
      <div className="mb-3">
        <div className="relative h-2 bg-spenza-canvas rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 bg-spenza-slate/25"
            style={{
              left: `${levelFraction(stream.levelDbfs.p05) * 100}%`,
              width: `${Math.max(
                1,
                (levelFraction(stream.levelDbfs.p95) - levelFraction(stream.levelDbfs.p05)) * 100,
              )}%`,
            }}
          />
          <div
            className="absolute inset-y-0 w-[3px] bg-spenza-orange rounded-full"
            style={{ left: `${levelFraction(stream.levelDbfs.p50) * 100}%` }}
          />
        </div>
        <div className="flex justify-between text-[10.5px] font-mono text-spenza-mute mt-1">
          <span>−90</span>
          <span className="text-spenza-slate">median {fmtDbfs(stream.levelDbfs.p50)}</span>
          <span>0 dBFS</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4">
        <Row label="Active" value={fmtPct(stream.activeRatio)} />
        <Row label="Clipping" value={fmtPct(stream.clippingRatio, 3)} />
        <Row label="Gaps" value={String(stream.gapCount)} />
        <Row label="Longest gap" value={fmtMs(stream.longestGapMs)} />
      </div>
    </div>
  );
}

/** Colour by G.107 satisfaction band. Semantic, separate from the brand accent. */
const RATING_TONE: Record<NonNullable<QosPathQuality["rating"]>["category"], string> = {
  best: "text-spenza-success",
  high: "text-spenza-success",
  medium: "text-[#B45309]",
  low: "text-spenza-danger",
  poor: "text-spenza-danger",
};

function PathCard({ q }: { q: QosPathQuality }) {
  return (
    <div className="border border-spenza-border rounded-input p-3.5">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <span className="text-[13px] font-semibold text-spenza-ink">{PATH_LABEL[q.path]}</span>
        {q.rating ? (
          <span className={cn("text-[13px] font-semibold tabular-nums", RATING_TONE[q.rating.category])}>
            {q.rating.mosCqe.toFixed(2)}
            <span className="text-[11px] font-normal text-spenza-mute ml-1">MOS-CQE</span>
          </span>
        ) : (
          <span className="text-[11px] text-spenza-mute">No RTCP</span>
        )}
      </div>
      <p className="text-[11.5px] text-spenza-slate mb-3">{PATH_EXPERIENCED_BY[q.path]}</p>

      {q.rating ? (
        <div className="mb-3">
          {/* R factor on its 0-100 scale, with the R=70 acceptability line marked. */}
          <div className="relative h-1.5 bg-spenza-canvas rounded-full overflow-hidden">
            <div
              className={cn(
                "absolute inset-y-0 left-0 rounded-full",
                q.rating.rFactor >= 80
                  ? "bg-spenza-success"
                  : q.rating.rFactor >= 70
                    ? "bg-spenza-amber"
                    : "bg-spenza-danger",
              )}
              style={{ width: `${Math.max(2, q.rating.rFactor)}%` }}
            />
            <div className="absolute inset-y-0 w-px bg-spenza-slate/40" style={{ left: "70%" }} />
          </div>
          <div className="flex justify-between text-[10.5px] font-mono text-spenza-mute mt-1">
            <span>R {q.rating.rFactor.toFixed(1)}</span>
            <span className="text-spenza-slate">{RATING_LABEL[q.rating.category]}</span>
            <span>100</span>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-x-4">
        <Row label="Packet loss" value={fmtPct(q.packetLossPercent === null ? null : q.packetLossPercent / 100, 2)} />
        <Row label="Jitter, mean" value={fmtMs(q.jitterMsMean)} />
        <Row label="Jitter, peak" value={fmtMs(q.jitterMsMax)} />
        <Row label="RTCP reports" value={String(q.reportCount)} />
      </div>
    </div>
  );
}

export function QosDetail({ report }: { report: QosReport }) {
  const oneWayText =
    report.oneWayAudio === "caller_to_callee"
      ? "Caller audio reached the node; the callee side sent nothing audible."
      : report.oneWayAudio === "callee_to_caller"
        ? "Callee audio reached the node; the caller side sent nothing audible."
        : null;

  return (
    <div className="p-5">
      <header className="mb-5">
        <div className="flex items-center gap-2.5 flex-wrap mb-2">
          <VerdictPill verdict={report.verdict} />
          <span className="text-[11px] font-mono text-spenza-mute">{report.mode}</span>
          <span className="text-[11px] font-mono text-spenza-mute">· {report.coverage}</span>
        </div>
        <h2 className="text-[17px] font-semibold text-spenza-ink leading-tight">
          {formatPhone(report.call.callerNumber)} → {formatPhone(report.call.calleeNumber)}
        </h2>
        <p className="text-[12.5px] text-spenza-slate mt-1">
          {new Date(report.call.startedAt).toLocaleString()} · instrumented number{" "}
          {formatPhone(report.call.gatedNumber)}
        </p>
      </header>

      {oneWayText ? (
        <div className="flex items-start gap-2.5 bg-spenza-danger-soft border border-[#FCA5A5] rounded-input px-3.5 py-3 mb-5">
          <CircleAlert className="w-4 h-4 text-spenza-danger shrink-0 mt-0.5" strokeWidth={2} />
          <p className="text-[13px] text-spenza-danger leading-relaxed">{oneWayText}</p>
        </div>
      ) : null}

      {report.findings.length > 0 ? (
        <Section title="Findings">
          <ul className="flex flex-col gap-2">
            {report.findings.map((f, i) => (
              <FindingRow key={`${f.code}-${i}`} finding={f} />
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="Call setup">
        <Row
          label="Time to ringing"
          value={fmtMs(report.timing.signalingRingingMs)}
          hint="Signalling on the trunk. Does not prove a handset rang."
        />
        <Row label="Ringing to answer" value={fmtMs(report.timing.answerDelayMs)} />
        <Row
          label="Answer to bridge"
          value={fmtMs(report.timing.bridgeDelayMs)}
          hint="Media cannot flow before both legs are bridged."
        />
        <Row label="Answered" value={report.call.answered ? "Yes" : "No"} />
        <Row
          label="Ended"
          value={
            report.call.hangupCause !== null
              ? `${report.call.hangupCauseText ?? "Cause"} (${report.call.hangupCause})`
              : "—"
          }
        />
        <Row label="Talk time" value={fmtMs(report.call.talkTimeMs)} />
      </Section>

      <Section title="Audio, by direction">
        <div className="flex flex-col gap-3">
          {report.audio.length === 0 ? (
            <p className="text-[13px] text-spenza-slate">No audio was captured for this call.</p>
          ) : (
            report.audio.map((s) => <StreamCard key={s.side} stream={s} />)
          )}
        </div>
      </Section>

      {report.quality.length > 0 ? (
        <Section title="Transmission quality, by direction">
          <p className="text-[12.5px] text-spenza-slate leading-relaxed mb-3 max-w-[62ch]">
            ITU-T G.107 E-model. Each RTCP report describes what its sender received, so the
            four paths are measured independently — loss on <em>node → callee</em> points at the
            far end&apos;s network, loss on <em>caller → node</em> at something upstream of us.
          </p>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {report.quality.map((q) => (
              <PathCard key={q.path} q={q} />
            ))}
          </div>
          <p className="text-[11.5px] text-spenza-mute leading-relaxed mt-3 max-w-[62ch]">
            MOS-CQE is a <strong>parametric</strong> rating from loss, jitter and delay — not a
            listening-quality score derived from the audio. That would need a reference signal a
            real call does not carry.
          </p>
        </Section>
      ) : null}

      {report.transport ? (
        <Section title="Transport (RTCP), whole call">
          <Row label="Jitter, peak" value={fmtMs(report.transport.jitterMsMax)} />
          <Row label="Jitter, mean" value={fmtMs(report.transport.jitterMsMean)} />
          <Row
            label="Packets lost"
            value={report.transport.packetsLost === null ? "—" : String(report.transport.packetsLost)}
          />
          <Row label="Worst loss fraction" value={fmtPct(report.transport.fractionLostMax, 2)} />
          <Row label="Round-trip time, mean" value={fmtMs(report.transport.rttMsMean)} />
          <Row label="RTCP reports seen" value={String(report.transport.reportCount)} />
        </Section>
      ) : null}

      <Section title="What this measurement does not show">
        <ul className="flex flex-col gap-2">
          {report.measurement.limits.map((limit, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5 text-[12.5px] text-spenza-slate leading-relaxed"
            >
              <ShieldQuestion className="w-3.5 h-3.5 shrink-0 mt-[3px] text-spenza-mute" strokeWidth={2} />
              <span>{limit}</span>
            </li>
          ))}
        </ul>
      </Section>

      <footer className="pt-3 border-t border-spenza-border text-[11px] font-mono text-spenza-mute leading-relaxed break-all">
        {report.reportId} · node {report.nodeId} · schema v{report.schemaVersion} ·{" "}
        {report.measurement.observationPoint}
      </footer>
    </div>
  );
}
