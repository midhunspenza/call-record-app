"use client";

import { motion } from "framer-motion";
import { CountUp } from "@/components/CountUp";
import { LiveDot } from "@/components/LiveDot";
import { ArrowDown, ArrowUp } from "lucide-react";

export type StatCardProps = {
  icon: React.ReactNode;
  label: string;
  value: number;
  suffix?: string;
  delta: string;
  deltaDirection: "up" | "down";
  deltaCopy: string;
  live?: boolean;
  delay?: number;
};

export function StatCard({
  icon,
  label,
  value,
  suffix,
  delta,
  deltaDirection,
  deltaCopy,
  live,
  delay = 0,
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay, ease: "easeOut" }}
      className="card p-[18px] flex flex-col gap-2"
    >
      <div className="flex items-center justify-between">
        <div className="w-9 h-9 bg-spenza-orange-soft text-spenza-orange rounded-[10px] flex items-center justify-center">
          {icon}
        </div>
        {live && <LiveDot size="sm" />}
      </div>
      <div className="eyebrow mt-1">{label}</div>
      <div className="text-2xl sm:text-3xl font-semibold tracking-tight tnum">
        <CountUp to={value} />
        {suffix && (
          <span className="text-base sm:text-lg text-spenza-mute font-medium ml-1">{suffix}</span>
        )}
      </div>
      <div
        className={`text-xs font-medium inline-flex items-center gap-1 ${
          deltaDirection === "up" ? "text-spenza-success" : "text-spenza-danger"
        }`}
      >
        {deltaDirection === "up" ? (
          <ArrowUp strokeWidth={2} className="w-3.5 h-3.5" />
        ) : (
          <ArrowDown strokeWidth={2} className="w-3.5 h-3.5" />
        )}
        <span className="mono">{delta}</span>
        <span className="text-spenza-mute font-normal">{deltaCopy}</span>
      </div>
    </motion.div>
  );
}
