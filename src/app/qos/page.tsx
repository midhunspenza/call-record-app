"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { LiveDot } from "@/components/LiveDot";
import { useQosReports } from "@/hooks/useQosReports";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/cn";
import { QosSummary } from "./QosSummary";
import { QosList } from "./QosList";
import { QosDetail } from "./QosDetail";

/**
 * Call quality screen (ISIM-718).
 *
 * This screen is CUSTOMER-FACING. Every string on it comes from
 * lib/qos-presentation.ts, which is the single place the boundary is defined:
 * no carrier name, no infrastructure, no internal identifiers, no engineering
 * diagnostics. Read that file before adding a field here.
 *
 * Only monitored numbers appear — deliberately not a view of all traffic.
 */
export default function QosPage() {
  const { reports, stats, loading, error, live } = useQosReports();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [numberFilter, setNumberFilter] = useState<string | null>(null);

  const numbers = useMemo(() => {
    const set = new Set(reports.map((r) => r.report.call.gatedNumber));
    return [...set].sort();
  }, [reports]);

  const visible = useMemo(
    () => (numberFilter ? reports.filter((r) => r.report.call.gatedNumber === numberFilter) : reports),
    [reports, numberFilter],
  );

  // Keep a selection pinned to something that still exists after a filter
  // change or an eviction, rather than showing an empty detail pane.
  useEffect(() => {
    if (visible.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !visible.some((r) => r.report.reportId === selectedId)) {
      setSelectedId(visible[0].report.reportId);
    }
  }, [visible, selectedId]);

  const selected = visible.find((r) => r.report.reportId === selectedId)?.report ?? null;

  return (
    <AppShell crumb="Call Quality">
      <div className="flex flex-col gap-5 max-w-[1400px]">
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[26px] font-bold text-[#111827] leading-tight tracking-tight">
              Call Quality
            </h1>
            <div className="h-1 w-16 rounded-full bg-gradient-to-r from-[#2FA36A] to-[#1E63B5] mt-2.5 mb-2" />
            <p className="text-[13.5px] text-[#6B7280]">
              Independent quality measurement for every call on your monitored numbers.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[12px] text-spenza-slate">
            {live ? <LiveDot size="sm" /> : <span className="w-2 h-2 rounded-full bg-spenza-mute" />}
            <span>{live ? "Live" : "Reconnecting"}</span>

          </div>
        </header>

        {error ? (
          <div className="flex items-start gap-2.5 bg-spenza-danger-soft border border-[#FCA5A5] rounded-card px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-spenza-danger shrink-0 mt-0.5" strokeWidth={2} />
            <p className="text-[13px] text-[#B91C1C]">Results could not be loaded. Please try again.</p>
          </div>
        ) : null}

        <QosSummary reports={visible} />

        {numbers.length > 1 ? (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setNumberFilter(null)}
              className={cn(
                "px-3.5 py-2 rounded-xl text-[12.5px] font-medium border transition-colors duration-150",
                numberFilter === null
                  ? "bg-[#111827] text-white border-[#111827]"
                  : "bg-white text-[#6B7280] border-[#E5E7EB] hover:border-[#9CA3AF]",
              )}
            >
              All numbers
            </button>
            {numbers.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNumberFilter(n)}
                className={cn(
                  "px-3.5 py-2 rounded-xl text-[12.5px] font-medium border transition-colors duration-150",
                  numberFilter === n
                    ? "bg-[#111827] text-white border-[#111827]"
                    : "bg-white text-[#6B7280] border-[#E5E7EB] hover:border-[#9CA3AF]",
                )}
              >
                {formatPhone(n)}
              </button>
            ))}
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] gap-4 items-start">
          <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-[#E5E7EB]">
              <span className="text-[12px] font-semibold text-[#111827]">Recent calls</span>
            </div>
            {loading ? (
              <p className="p-8 text-[13px] text-[#9CA3AF]">Loading…</p>
            ) : (
              <QosList reports={visible} selectedId={selectedId} onSelect={setSelectedId} />
            )}
          </div>

          <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-sm min-h-[320px]">
            {selected ? (
              <QosDetail report={selected} />
            ) : (
              <div className="p-12 text-center">
                <p className="text-[14px] font-semibold text-[#111827] mb-1.5">Select a call</p>
                <p className="text-[12.5px] text-[#6B7280] max-w-[40ch] mx-auto leading-relaxed">
                  Choose a call to see how it connected, what each side sent, and the quality each
                  party received.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
