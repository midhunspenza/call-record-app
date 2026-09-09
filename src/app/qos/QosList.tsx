"use client";

import { ArrowDownLeft, ArrowUpRight, VolumeX } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatPhone } from "@/lib/phone";
import { fmtMs, type StoredQosReport } from "@/lib/qos";
import { VerdictPill } from "./VerdictPill";

function clock(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function duration(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function QosList({
  reports,
  selectedId,
  onSelect,
}: {
  reports: StoredQosReport[];
  selectedId: string | null;
  onSelect: (reportId: string) => void;
}) {
  if (reports.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-[14px] font-medium text-spenza-ink mb-1">No calls measured yet</p>
        <p className="text-[12.5px] text-spenza-slate leading-relaxed max-w-[38ch] mx-auto">
          Reports appear here once an instrumented number takes a call. An empty list can also mean
          the numbers are not yet routed to the SIP node.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-spenza-border">
      {reports.map(({ report }) => {
        const active = report.reportId === selectedId;
        const Dir = report.call.direction === "inbound" ? ArrowDownLeft : ArrowUpRight;
        // Surface the single most useful number per row: how long until the
        // far side heard anything. That is the question the screen exists for.
        const firstAudio = report.audio.find((a) => a.side === "callee")?.firstAudioMs ?? null;

        return (
          <li key={report.reportId}>
            <button
              type="button"
              onClick={() => onSelect(report.reportId)}
              aria-current={active}
              className={cn(
                "w-full text-left px-4 py-3 transition-colors duration-150",
                "hover:bg-spenza-canvas focus-visible:outline-none focus-visible:bg-spenza-canvas",
                "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-spenza-orange",
                active && "bg-spenza-orange-soft hover:bg-spenza-orange-soft",
              )}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Dir className="w-3.5 h-3.5 text-spenza-slate shrink-0" strokeWidth={2} />
                <span className="text-[13px] font-medium text-spenza-ink truncate">
                  {formatPhone(report.call.callerNumber)}
                </span>
                <span className="text-spenza-mute text-[12px]">→</span>
                <span className="text-[13px] font-medium text-spenza-ink truncate">
                  {formatPhone(report.call.calleeNumber)}
                </span>
                <VerdictPill verdict={report.verdict} className="ml-auto" />
              </div>

              <div className="flex items-center gap-3 text-[11.5px] text-spenza-slate font-mono">
                <span>{clock(report.call.startedAt)}</span>
                <span>{duration(report.call.durationMs)}</span>
                <span title="Time to first audible audio at the callee side">
                  audio {fmtMs(firstAudio)}
                </span>
                {report.oneWayAudio ? (
                  <span className="inline-flex items-center gap-1 text-spenza-danger font-semibold">
                    <VolumeX className="w-3 h-3" strokeWidth={2.2} />
                    one-way
                  </span>
                ) : null}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
