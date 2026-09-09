"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, HardDrive } from "lucide-react";
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
 * Shows per-call measurements delivered by the capture agent on the SIP node.
 * Only the instrumented numbers appear here — this is deliberately not a view
 * of all traffic, and the header says which numbers are in scope so an empty
 * list is never mistaken for "everything is fine".
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
            <h1 className="text-[22px] font-semibold text-spenza-ink leading-tight">Call Quality</h1>
            <p className="text-[13px] text-spenza-slate mt-1">
              Per-call measurement for instrumented numbers only.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[12px] text-spenza-slate">
            {live ? <LiveDot size="sm" /> : <span className="w-2 h-2 rounded-full bg-spenza-mute" />}
            <span>{live ? "Live" : "Reconnecting"}</span>
            {stats?.persisted === false ? (
              <span
                className="inline-flex items-center gap-1 ml-2 text-[11.5px] text-[#B45309]"
                title="QOS_STORE_PATH is unset, so reports are held in memory and lost on each deploy."
              >
                <HardDrive className="w-3.5 h-3.5" strokeWidth={2} />
                In-memory only
              </span>
            ) : null}
          </div>
        </header>

        {error ? (
          <div className="flex items-start gap-2.5 bg-spenza-danger-soft border border-[#FCA5A5] rounded-card px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-spenza-danger shrink-0 mt-0.5" strokeWidth={2} />
            <p className="text-[13px] text-spenza-danger">Could not load history: {error}</p>
          </div>
        ) : null}

        <QosSummary reports={visible} />

        {numbers.length > 1 ? (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setNumberFilter(null)}
              className={cn(
                "px-3 py-1.5 rounded-btn text-[12.5px] font-medium border transition-colors duration-150",
                numberFilter === null
                  ? "bg-spenza-charcoal text-white border-spenza-charcoal"
                  : "bg-spenza-surface text-spenza-slate border-spenza-border hover:border-spenza-slate",
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
                  "px-3 py-1.5 rounded-btn text-[12.5px] font-medium border transition-colors duration-150",
                  numberFilter === n
                    ? "bg-spenza-charcoal text-white border-spenza-charcoal"
                    : "bg-spenza-surface text-spenza-slate border-spenza-border hover:border-spenza-slate",
                )}
              >
                {formatPhone(n)}
              </button>
            ))}
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] gap-4 items-start">
          <div className="bg-spenza-surface border border-spenza-border rounded-card overflow-hidden shadow-card">
            <div className="px-4 py-2.5 border-b border-spenza-border">
              <span
                className="text-[10px] font-semibold uppercase text-spenza-mute"
                style={{ letterSpacing: "0.16em" }}
              >
                Measured calls
              </span>
            </div>
            {loading ? (
              <p className="p-6 text-[13px] text-spenza-slate">Loading…</p>
            ) : (
              <QosList reports={visible} selectedId={selectedId} onSelect={setSelectedId} />
            )}
          </div>

          <div className="bg-spenza-surface border border-spenza-border rounded-card overflow-hidden shadow-card min-h-[280px]">
            {selected ? (
              <QosDetail report={selected} />
            ) : (
              <div className="p-8 text-center">
                <p className="text-[14px] font-medium text-spenza-ink mb-1">Nothing selected</p>
                <p className="text-[12.5px] text-spenza-slate max-w-[40ch] mx-auto leading-relaxed">
                  Pick a call to see its setup timing, per-direction audio, and what the measurement
                  can and cannot establish.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
