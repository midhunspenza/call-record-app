"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronsLeft,
  ChevronsRight,
  Pause,
  Download,
} from "lucide-react";
import { LiveDot } from "@/components/LiveDot";
import { fmtTC } from "./data";

export function WaveformCard({ durationStart }: { durationStart: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const [timecode, setTimecode] = useState(fmtTC(Date.now() - durationStart));

  // VU level segments (top → bottom). Higher index = louder.
  const segCount = 20;
  const [vuLevel, setVuLevel] = useState(8);

  useEffect(() => {
    const update = () => setTimecode(fmtTC(Date.now() - durationStart));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [durationStart]);

  useEffect(() => {
    const id = setInterval(() => {
      setVuLevel(Math.floor(4 + Math.random() * (segCount - 4)));
    }, 110);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;
    const BAR_W = 3;
    const GAP = 2;
    const total = Math.max(1, Math.floor(W / (BAR_W + GAP)));
    const buf: number[] = new Array(total).fill(0).map((_, i) => {
      const env = Math.sin((i / total) * Math.PI * 3) * 0.3 + 0.5;
      return Math.max(0.05, env * (0.5 + Math.random() * 0.5));
    });

    let t = 0;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth = 1;
      for (let y = 0; y <= 4; y++) {
        const yy = Math.round((y / 4) * H) + 0.5;
        ctx.beginPath();
        ctx.moveTo(0, yy);
        ctx.lineTo(W, yy);
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.beginPath();
      ctx.moveTo(0, H / 2 + 0.5);
      ctx.lineTo(W, H / 2 + 0.5);
      ctx.stroke();

      buf.shift();
      const burst = Math.sin(t * 0.05) > 0 ? 1 : 0.25;
      const amp = (0.15 + Math.random() * 0.85) * burst;
      buf.push(amp);

      for (let i = 0; i < buf.length; i++) {
        const v = buf[i];
        const x = i * (BAR_W + GAP);
        const h = Math.max(2, v * (H - 8));
        const y = (H - h) / 2;
        const alpha = 0.4 + (i / buf.length) * 0.6;
        ctx.fillStyle = `rgba(255,69,0,${alpha})`;
        ctx.fillRect(x, y, BAR_W, h);
      }

      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(W - 1, 4);
      ctx.lineTo(W - 1, H - 4);
      ctx.stroke();

      t++;
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="bg-spenza-charcoal border border-spenza-border-dark rounded-card p-3.5 sm:p-4 sm:px-5 shadow-card relative overflow-hidden">
      <div className="flex items-center justify-between mb-2.5 text-[#d4d4d4]">
        <span className="inline-flex items-center gap-2 text-xs font-medium text-white">
          <LiveDot size="sm" />
          Listening live · SpenzaJ trunk
        </span>
        <span className="mono text-[13px] text-[#d4d4d4] tnum">{timecode}</span>
      </div>

      <div className="grid grid-cols-[1fr_32px] sm:grid-cols-[1fr_40px] gap-3 sm:gap-[14px] items-stretch">
        <canvas ref={canvasRef} className="block w-full h-24 sm:h-32" />
        <div className="flex flex-col gap-[3px] justify-end py-1">
          {Array.from({ length: segCount }).map((_, i) => {
            const onIdx = segCount - 1 - i;
            const isOn = onIdx <= vuLevel;
            let cls = "bg-[#2a2a2a]";
            if (isOn && onIdx < segCount - 4) cls = "bg-spenza-orange-bright";
            else if (isOn && onIdx >= segCount - 4 && onIdx < segCount - 2) cls = "bg-[#FBBF24]";
            else if (isOn && onIdx >= segCount - 2) cls = "bg-spenza-danger";
            return (
              <span
                key={i}
                className={`flex-1 rounded-sm transition-[background] duration-[80ms] ease-out ${cls}`}
              />
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/[0.08]">
        <IcoBtn ariaLabel="Skip back">
          <ChevronsLeft strokeWidth={1.75} className="w-3.5 h-3.5" />
        </IcoBtn>
        <IcoBtn primary ariaLabel="Pause">
          <Pause strokeWidth={1.75} className="w-3.5 h-3.5" />
        </IcoBtn>
        <IcoBtn ariaLabel="Skip forward">
          <ChevronsRight strokeWidth={1.75} className="w-3.5 h-3.5" />
        </IcoBtn>
        <IcoBtn ariaLabel="Download recording">
          <Download strokeWidth={1.75} className="w-3.5 h-3.5" />
        </IcoBtn>
        <span className="ml-auto mono text-[11px] text-spenza-mute" style={{ letterSpacing: "0.02em" }}>
          recording · 16 kHz · stereo
        </span>
      </div>
    </div>
  );
}

function IcoBtn({
  children,
  primary,
  ariaLabel,
}: {
  children: React.ReactNode;
  primary?: boolean;
  ariaLabel: string;
}) {
  return (
    <button
      aria-label={ariaLabel}
      className={`w-8 h-8 rounded-[10px] flex items-center justify-center border transition-colors duration-150 ${
        primary
          ? "bg-spenza-orange border-spenza-orange text-white hover:bg-[#d44d09]"
          : "bg-transparent border-white/10 text-[#d4d4d4] hover:bg-white/[0.06] hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
