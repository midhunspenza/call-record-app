"use client";

import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatPhone } from "@/lib/phone";
import type { StoredQosReport } from "@/lib/qos";
import { VERDICT_PRESENTATION, duration, scoreOutOfFive } from "@/lib/qos-presentation";
import { TONE_STYLES } from "./VerdictPill";

function clock(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
      <div className="p-10 text-center">
        <p className="text-[14px] font-semibold text-[#111827] mb-1.5">No calls measured yet</p>
        <p className="text-[12.5px] text-[#6B7280] leading-relaxed max-w-[38ch] mx-auto">
          Results appear here automatically once a call is made or received on a monitored number.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-[#E5E7EB]">
      {reports.map(({ report }) => {
        const active = report.reportId === selectedId;
        const inbound = report.call.direction === "inbound";
        const Dir = inbound ? ArrowDownLeft : ArrowUpRight;
        const v = VERDICT_PRESENTATION[report.verdict];

        // The score for what this customer's own line received.
        const wanted = inbound ? "node_to_callee" : "node_to_caller";
        const rating = report.quality.find((q) => q.path === wanted)?.rating ?? null;

        return (
          <li key={report.reportId}>
            <button
              type="button"
              onClick={() => onSelect(report.reportId)}
              aria-current={active}
              className={cn(
                "w-full text-left px-5 py-4 transition-colors duration-150",
                "hover:bg-[#F9FAFB] focus-visible:outline-none focus-visible:bg-[#F9FAFB]",
                "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1E63B5]/40",
                active && "bg-[#1E63B5]/[0.05] hover:bg-[#1E63B5]/[0.05]",
              )}
            >
              <div className="flex items-center gap-2.5 mb-1.5">
                <Dir className="w-3.5 h-3.5 text-[#9CA3AF] shrink-0" strokeWidth={2} />
                <span className="text-[13.5px] font-semibold text-[#111827] truncate">
                  {formatPhone(inbound ? report.call.callerNumber : report.call.calleeNumber)}
                </span>
                <span className={cn("ml-auto w-2 h-2 rounded-full shrink-0", TONE_STYLES[v.tone].dot)} />
              </div>

              <div className="flex items-center gap-3 text-[12px] text-[#6B7280]">
                <span className="tabular-nums">{clock(report.call.startedAt)}</span>
                <span className="tabular-nums">{duration(report.call.durationMs)}</span>
                <span className={cn("font-medium", TONE_STYLES[v.tone].text)}>{v.label}</span>
                {rating ? (
                  <span className="ml-auto tabular-nums font-semibold text-[#111827]">
                    {scoreOutOfFive(rating)}
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
