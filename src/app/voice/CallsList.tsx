"use client";

import { useEffect, useState } from "react";
import { Search, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { LiveDot } from "@/components/LiveDot";
import { Call, fmtDur } from "./data";
import { cn } from "@/lib/cn";

type Filter = "all" | "in" | "out";

export function CallsList({
  calls,
  selectedId,
  onSelect,
}: {
  calls: Call[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const visible = calls.filter((c) =>
    filter === "all" ? true : c.direction === filter,
  );

  return (
    <aside className="bg-white border border-spenza-border rounded-card shadow-card flex flex-col overflow-hidden lg:h-auto">
      <div className="p-3 sm:p-3.5 sm:px-4 sm:pb-2.5 border-b border-spenza-border bg-white sticky top-0 z-[2]">
        <div className="relative mb-2.5">
          <Search strokeWidth={1.75} className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-spenza-mute" />
          <input
            placeholder="Search by number or extension"
            className="w-full h-9 px-3 pl-9 border border-spenza-border rounded-[10px] text-[13px] bg-[#fafafa] focus:outline-none focus:border-spenza-orange focus:shadow-focus focus:bg-white"
          />
        </div>
        <div className="flex gap-1.5">
          {(["all", "in", "out"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-2.5 py-[5px] rounded-full text-xs font-medium transition-[background,color] duration-150",
                filter === f
                  ? "bg-spenza-ink text-white"
                  : "bg-[#f4f4f4] text-spenza-slate hover:text-spenza-ink",
              )}
            >
              {f === "all" ? "All" : f === "in" ? "Inbound" : "Outbound"}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile: horizontal strip. Desktop: vertical list. */}
      <div className="flex-1 overflow-x-auto lg:overflow-x-hidden lg:overflow-y-auto p-2 scroll">
        <div className="flex lg:flex-col gap-2 lg:gap-0">
          {visible.map((c) => {
            const selected = c.id === selectedId;
            return (
              <div
                key={c.id}
                onClick={() => onSelect(c.id)}
                className={cn(
                  "relative grid grid-cols-[1fr_auto] gap-x-2.5 gap-y-1 px-3 py-3 pl-3.5 rounded-xl border cursor-pointer transition-[background,border-color] duration-[120ms] shrink-0 w-[260px] lg:w-auto",
                  selected
                    ? "bg-spenza-orange-soft border-[#fde0cd]"
                    : "border-transparent hover:bg-[#fafafa]",
                )}
              >
                {selected && (
                  <span className="absolute -left-px top-2 bottom-2 w-[3px] bg-spenza-orange rounded-r-[3px]" />
                )}
                <div
                  className="mono text-[13px] font-medium text-spenza-ink flex items-center gap-1.5 min-w-0"
                  style={{ letterSpacing: "-0.01em" }}
                >
                  {c.direction === "in" ? (
                    <ArrowDownLeft strokeWidth={1.75} className="w-3.5 h-3.5 text-spenza-success shrink-0" />
                  ) : (
                    <ArrowUpRight strokeWidth={1.75} className="w-3.5 h-3.5 text-spenza-orange shrink-0" />
                  )}
                  <span className="truncate">{c.from}</span>
                </div>
                <div className="mono text-[13px] font-medium text-spenza-ink tnum flex items-center gap-1.5">
                  {c.streaming && <LiveDot size="sm" />}
                  <span suppressHydrationWarning>{fmtDur(now - c.durationStart)}</span>
                </div>
                <div className="col-start-1 mono text-[11px] text-spenza-mute truncate">→ {c.to}</div>
                <div className="col-span-2 text-xs text-spenza-mute whitespace-nowrap overflow-hidden text-ellipsis mt-0.5">
                  {c.snippet}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
