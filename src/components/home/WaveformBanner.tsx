"use client";

import { useEffect, useRef, useState } from "react";

const W = 600;
const H = 160;

export function WaveformBanner() {
  const [d, setD] = useState<string>("");
  const raf = useRef<number | null>(null);

  useEffect(() => {
    let phase = 0;
    const tick = () => {
      const pts: string[] = [];
      for (let x = 0; x <= W; x += 6) {
        const a =
          Math.sin((x + phase) * 0.04) * 28 +
          Math.sin((x + phase) * 0.11) * 14 +
          Math.sin((x + phase) * 0.21) * 7;
        pts.push(`${x},${(H / 2 + a).toFixed(1)}`);
      }
      setD("M" + pts.join(" L"));
      phase += 2.4;
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, []);

  return (
    <>
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1.4px)",
          backgroundSize: "18px 18px",
        }}
      />
      <svg
        viewBox="0 0 600 160"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="absolute inset-0 w-full h-full"
      >
        <path d={d} fill="none" stroke="#FF4500" strokeWidth={1.5} strokeLinecap="round" />
      </svg>
      <div
        className="absolute top-0 bottom-0 w-20 animate-scan"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(255,69,0,0.18), transparent)",
        }}
      />
    </>
  );
}
