"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

type Props = {
  href: string;
  banner: React.ReactNode;
  title: string;
  copy: string;
  chips: string[];
  cta: string;
  delay?: number;
};

export function ActionCard({ href, banner, title, copy, chips, cta, delay = 0 }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay, ease: "easeOut" }}
    >
      <Link
        href={href}
        className="card overflow-hidden flex flex-col h-full transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lift group"
      >
        <div className="relative h-40 bg-spenza-charcoal overflow-hidden">{banner}</div>
        <div className="p-[22px] pb-6 flex-1 flex flex-col">
          <h3 className="text-xl font-semibold mb-2 tracking-tight">{title}</h3>
          <p className="text-sm text-spenza-slate leading-[1.55] mb-[18px] flex-1">{copy}</p>
          <div className="flex gap-1.5 mb-[18px]">
            {chips.map((c) => (
              <span key={c} className="pill pill-mono">
                {c}
              </span>
            ))}
          </div>
          <span className="btn btn-primary self-start">
            {cta}
            <ArrowRight
              strokeWidth={2}
              className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-[3px]"
            />
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
