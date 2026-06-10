"use client";

import { useEffect, useState } from "react";
import { Bell, Menu } from "lucide-react";
import { LiveDot } from "@/components/LiveDot";
import { useSidebar } from "./SidebarContext";
import { useLiveEvents } from "@/hooks/useLiveEvents";

function formatClock(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function Topbar({ crumb }: { crumb: string }) {
  const [time, setTime] = useState<string>("");
  const { setOpen } = useSidebar();
  const { status } = useLiveEvents();

  useEffect(() => {
    const update = () => setTime(formatClock(new Date()));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="h-16 bg-white border-b border-spenza-border flex items-center px-4 sm:px-6 lg:px-8 gap-3 sm:gap-4 lg:gap-6 sticky top-0 z-30">
      <button
        aria-label="Open menu"
        onClick={() => setOpen(true)}
        className="lg:hidden -ml-1 w-9 h-9 rounded-[10px] flex items-center justify-center text-spenza-slate hover:bg-[#fafafa] transition-colors duration-150"
      >
        <Menu strokeWidth={1.75} className="w-5 h-5" />
      </button>

      <div className="text-[13px] text-spenza-slate flex items-center gap-2 min-w-0">
        <span className="hidden sm:inline">Spenza Console</span>
        <span className="hidden sm:inline text-spenza-border">/</span>
        <strong className="text-spenza-ink font-medium truncate">{crumb}</strong>
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3 lg:gap-4">
        {status === "open" ? (
          <span className="pill pill-orange">
            <LiveDot size="sm" />
            <span className="hidden sm:inline">Live</span>
          </span>
        ) : (
          <span
            className="pill"
            style={{ background: "#fef6e7", color: "#b45309", borderColor: "#fde7b9" }}
            title={`Stream: ${status}`}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#F59E0B" }} />
            <span className="hidden sm:inline">{status === "connecting" ? "Connecting" : "Reconnecting"}</span>
          </span>
        )}
        <span
          className="hidden md:inline mono text-[13px] text-spenza-slate tnum"
          style={{ letterSpacing: "-0.01em" }}
        >
          {time || "  :  :  "}
        </span>
        <button
          aria-label="Notifications"
          className="relative w-9 h-9 rounded-[10px] flex items-center justify-center text-spenza-slate hover:bg-[#fafafa] transition-colors duration-150"
        >
          <Bell strokeWidth={1.75} className="w-[18px] h-[18px]" />
          <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 bg-spenza-orange-bright text-white rounded-full text-[10px] font-semibold mono flex items-center justify-center border-2 border-white">
            4
          </span>
        </button>
      </div>
    </header>
  );
}
