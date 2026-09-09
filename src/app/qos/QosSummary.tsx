"use client";

import { Info } from "lucide-react";
import { fmtMs, median, type QosVerdict, type StoredQosReport } from "@/lib/qos";
import { cn } from "@/lib/cn";

/**
 * Summary strip above the report list.
 *
 * Two rules it follows, both from the measurement discipline in ISIM-718:
 *
 *  - Counts are shown as "n of m", never as a bare success rate. Four good
 *    calls is not a 100% success rate, and a percentage on a tiny sample reads
 *    as a far stronger claim than the data supports.
 *  - The coverage label is printed, not implied. A SIP-trunk result is not a
 *    nationwide deliverability result.
 */

function Tile({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const toneClass =
    tone === "good"
      ? "text-spenza-success"
      : tone === "warn"
        ? "text-[#B45309]"
        : tone === "bad"
          ? "text-spenza-danger"
          : "text-spenza-ink";
  return (
    <div className="bg-spenza-surface border border-spenza-border rounded-card p-4 min-w-0">
      <div
        className="text-[10px] font-semibold uppercase text-spenza-mute mb-1.5"
        style={{ letterSpacing: "0.14em" }}
      >
        {label}
      </div>
      <div className={cn("text-[22px] font-semibold leading-none tabular-nums", toneClass)}>
        {value}
      </div>
      {sub ? <div className="text-[12px] text-spenza-slate mt-1.5 leading-snug">{sub}</div> : null}
    </div>
  );
}

export function QosSummary({ reports }: { reports: StoredQosReport[] }) {
  const total = reports.length;
  const count = (v: QosVerdict) => reports.filter((r) => r.report.verdict === v).length;

  const healthy = count("healthy");
  const degraded = count("degraded");
  const failing = count("failing");

  const medianRinging = median(reports.map((r) => r.report.timing.signalingRingingMs));
  const medianFirstAudio = median(
    reports.flatMap((r) => r.report.audio.map((a) => a.firstAudioMs)),
  );

  const coverage = reports[0]?.report.coverage ?? null;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile
          label="Calls measured"
          value={String(total)}
          sub={total === 0 ? "Nothing captured yet" : "Most recent 100"}
        />
        <Tile
          label="Verdict"
          value={total === 0 ? "—" : `${healthy} of ${total}`}
          sub={
            total === 0
              ? "No calls to judge"
              : `${healthy} healthy · ${degraded} degraded · ${failing} failing`
          }
          tone={failing > 0 ? "bad" : degraded > 0 ? "warn" : healthy > 0 ? "good" : "default"}
        />
        <Tile
          label="Median time to ringing"
          value={fmtMs(medianRinging)}
          sub="Signalling on the trunk, not a handset"
        />
        <Tile
          label="Median first audio"
          value={fmtMs(medianFirstAudio)}
          sub="From bridge to first audible frame"
        />
      </div>

      <div className="flex items-start gap-2.5 bg-spenza-orange-soft border border-[#FFD9C0] rounded-card px-4 py-3">
        <Info className="w-4 h-4 text-spenza-orange shrink-0 mt-0.5" strokeWidth={2} />
        <p className="text-[12.5px] text-[#7C3A12] leading-relaxed">
          Measured at the Asterisk boundary{coverage ? ` over ${coverage}` : ""}. These figures show
          what arrived at the node from each side — not what a handset played, and not nationwide
          deliverability. No listening-quality score is shown: scoring one needs a known reference
          signal, which real customer calls do not carry.
        </p>
      </div>
    </div>
  );
}
