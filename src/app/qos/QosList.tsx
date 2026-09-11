"use client";

import { ArrowDownLeft, ArrowUpRight, PhoneOff } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatPhone } from "@/lib/phone";
import type { StoredQosReport } from "@/lib/qos";
import { VERDICT_PRESENTATION, duration, scoreOutOfFive } from "@/lib/qos-presentation";
import { TONE_STYLES } from "./VerdictPill";

function clock(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** "Today" / "Yesterday" / a date — people navigate call history by day. */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (same(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function groupByDay(reports: StoredQosReport[]): Array<[string, StoredQosReport[]]> {
  const groups = new Map<string, StoredQosReport[]>();
  for (const r of reports) {
    const key = dayLabel(r.report.call.startedAt);
    const bucket = groups.get(key);
    if (bucket) bucket.push(r);
    else groups.set(key, [r]);
  }
  return [...groups.entries()];
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
      <div className="px-6 py-14 text-center">
        <div className="w-11 h-11 rounded-full bg-[#F3F4F6] flex items-center justify-center mx-auto mb-4">
          <PhoneOff className="w-5 h-5 text-[#9CA3AF]" strokeWidth={1.75} />
        </div>
        <p className="text-[14px] font-semibold text-[#111827] mb-1.5">No calls measured yet</p>
        <p className="text-[12.5px] text-[#6B7280] leading-relaxed max-w-[34ch] mx-auto">
          Results appear here automatically once a call is made or received on a monitored number.
        </p>
      </div>
    );
  }

  return (
    <div>
      {groupByDay(reports).map(([day, group]) => (
        <div key={day}>
          <div className="sticky top-0 z-10 px-5 py-2 bg-[#FAFAF9]/95 backdrop-blur-sm border-b border-[#E5E7EB]">
            <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide">
              {day}
            </span>
            <span className="text-[11px] text-[#9CA3AF] ml-2">
              {group.length} {group.length === 1 ? "call" : "calls"}
            </span>
          </div>

          <ul className="divide-y divide-[#E5E7EB]">
            {group.map(({ report }) => {
              const active = report.reportId === selectedId;
              const inbound = report.call.direction === "inbound";
              const Dir = inbound ? ArrowDownLeft : ArrowUpRight;
              const v = VERDICT_PRESENTATION[report.verdict];
              const wanted = inbound ? "node_to_callee" : "node_to_caller";
              const rating = report.quality.find((q) => q.path === wanted)?.rating ?? null;

              return (
                <li key={report.reportId} className="relative">
                  {/* A severity stripe, so the list scans by state before it is read. */}
                  <span
                    className={cn(
                      "absolute left-0 top-0 bottom-0 w-[3px]",
                      active ? TONE_STYLES[v.tone].dot : "bg-transparent",
                    )}
                  />
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
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                          inbound ? "bg-[#2FA36A]/10" : "bg-[#1E63B5]/10",
                        )}
                      >
                        <Dir
                          className={cn("w-4 h-4", inbound ? "text-[#2FA36A]" : "text-[#1E63B5]")}
                          strokeWidth={2}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[13.5px] font-semibold text-[#111827] truncate">
                            {formatPhone(
                              inbound ? report.call.callerNumber : report.call.calleeNumber,
                            )}
                          </span>
                          {rating ? (
                            <span
                              className={cn(
                                "text-[15px] font-bold tabular-nums shrink-0",
                                TONE_STYLES[v.tone].text,
                              )}
                            >
                              {scoreOutOfFive(rating)}
                            </span>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2 mt-0.5 text-[12px] text-[#9CA3AF]">
                          <span className="tabular-nums">{clock(report.call.startedAt)}</span>
                          <span>·</span>
                          <span className="tabular-nums">{duration(report.call.durationMs)}</span>
                          <span>·</span>
                          <span>{inbound ? "Incoming" : "Outgoing"}</span>
                        </div>

                        <div className="mt-1.5">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 text-[11.5px] font-semibold",
                              TONE_STYLES[v.tone].text,
                            )}
                          >
                            <span className={cn("w-1.5 h-1.5 rounded-full", TONE_STYLES[v.tone].dot)} />
                            {v.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
