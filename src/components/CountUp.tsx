"use client";

import { useEffect, useRef, useState } from "react";

export function CountUp({ to, duration = 900 }: { to: number; duration?: number }) {
  const [value, setValue] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const animate = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(to * ease));
      if (t < 1) raf.current = requestAnimationFrame(animate);
    };
    raf.current = requestAnimationFrame(animate);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, [to, duration]);

  return <>{value.toLocaleString()}</>;
}
