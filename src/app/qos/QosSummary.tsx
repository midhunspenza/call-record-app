"use client";

import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import { median, type QosVerdict, type StoredQosReport } from "@/lib/qos";
import { MEASUREMENT_NOTE, seconds, type Tone } from "@/lib/qos-presentation";
import { TONE_STYLES } from "./VerdictPill";
import { EXPLAINS, Explain } from "./Explain";

/**
 * Overview strip.
 *
 * Two rules it follows, both load-bearing:
 *
 *  - Counts are "n of m", never a bare percentage. Four good calls is not a
 *    100% success rate, and a percentage on a small sample reads as a far
 *    stronger claim than the data supports.
 *  - Nothing here names the carrier or our infrastructure — see
 *    qos-presentation.ts for the full boundary.
 */

function Tile({
  label,
  value,
  sub,
  tone = "neutral",
  explain,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
  explain?: string;
}) {
  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 min-w-0">
      <div className="text-[11.5px] font-medium text-[#6B7280] mb-2 flex items-center gap-1.5">
        {label}
        {explain ? <Explain text={explain} /> : null}
      </div>
      <div className={cn("text-[26px] font-bold leading-none tabular-nums tracking-tight", TONE_STYLES[tone].text)}>
        {value}
      </div>
      {sub ? <div className="text-[12px] text-[#9CA3AF] mt-2 leading-snug">{sub}</div> : null}
    </div>
  );
}

export function QosSummary({ reports }: { reports: StoredQosReport[] }) {
  const total = reports.length;
  const count = (v: QosVerdict) => reports.filter((r) => r.report.verdict === v).length;

  const good = count("healthy");
  const degraded = count("degraded");
  const failing = count("failing");

  const medianRing = median(reports.map((r) => r.report.timing.signalingRingingMs));
  const medianFirstAudio = median(reports.flatMap((r) => r.report.audio.map((a) => a.firstAudioMs)));

  // Average the score a customer's own line received, which is the one that
  // answers "how were my calls?" — not a blend of all four directions.
  const yourScores = reports.flatMap((r) => {
    const wanted = r.report.call.direction === "inbound" ? "node_to_callee" : "node_to_caller";
    const q = r.report.quality.find((x) => x.path === wanted);
    return q?.rating ? [q.rating.mosCqe] : [];
  });
  const avgScore = yourScores.length
    ? (yourScores.reduce((a, b) => a + b, 0) / yourScores.length).toFixed(1)
    : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile
          label="Calls measured"
          explain={EXPLAINS.callsMeasured}
          value={String(total)}
          sub={total === 0 ? "Nothing measured yet" : "Most recent 100"}
        />
        <Tile
          label="Quality on your line"
          explain={EXPLAINS.qualityOnYourLine}
          value={avgScore ?? "—"}
          sub={avgScore ? "average score, out of 5" : "No scored calls yet"}
          tone={
            avgScore === null ? "neutral" : Number(avgScore) >= 4 ? "good" : Number(avgScore) >= 3.6 ? "warn" : "bad"
          }
        />
        <Tile
          label="Calls without issues"
          explain={EXPLAINS.callsWithoutIssues}
          value={total === 0 ? "—" : `${good} of ${total}`}
          sub={total === 0 ? "No calls to judge" : `${degraded} with issues · ${failing} poor`}
          tone={failing > 0 ? "bad" : degraded > 0 ? "warn" : good > 0 ? "good" : "neutral"}
        />
        <Tile
          label="Typical time to ring"
          explain={EXPLAINS.typicalTimeToRing}
          value={seconds(medianRing)}
          sub={medianFirstAudio !== null ? `audio after ${seconds(medianFirstAudio)}` : undefined}
        />
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-[#E5E7EB] bg-[#FDFCFB] px-5 py-4">
        <ShieldCheck className="w-4 h-4 text-[#2FA36A] shrink-0 mt-0.5" strokeWidth={2} />
        <p className="text-[12.5px] text-[#6B7280] leading-relaxed max-w-[76ch]">{MEASUREMENT_NOTE}</p>
      </div>
    </div>
  );
}
