"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Phone, FileAudio, MessageSquare, Activity, LogOut } from "lucide-react";
import { cn } from "@/lib/cn";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  badge?: string;
};

const items: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/voice", label: "Live Voice", icon: Phone, badge: "3" },
  { href: "/recordings", label: "Recordings", icon: FileAudio },
  { href: "/qos", label: "Call Quality", icon: Activity },
  { href: "/sms", label: "SMS", icon: MessageSquare },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void } = {}) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await fetch("/api/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside className="bg-spenza-charcoal text-white flex flex-col border-r border-spenza-border-dark h-screen w-full lg:w-[248px]">
      <div className="px-5 pt-[22px] pb-[18px] flex items-baseline gap-2.5 border-b border-spenza-border-dark">
        <span className="text-xl font-bold tracking-tight text-white">
          spenza
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-spenza-orange-bright ml-0.5 align-middle -translate-y-1" />
        </span>
        <span className="text-[10px] font-semibold uppercase text-spenza-orange-bright" style={{ letterSpacing: "0.16em" }}>
          Console
        </span>
      </div>

      <div className="text-[10px] font-semibold uppercase text-[#6b6b6b] px-5 pt-4 pb-2" style={{ letterSpacing: "0.18em" }}>
        Workspace
      </div>

      <nav className="px-3 py-2 flex flex-col gap-0.5 flex-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => onNavigate?.()}
              className={cn(
                "relative flex items-center gap-3 h-11 px-3.5 rounded-[10px] text-sm font-medium transition-[background,color] duration-150",
                active
                  ? "bg-white/[0.05] text-white"
                  : "text-spenza-mute hover:bg-white/[0.04] hover:text-white",
              )}
            >
              {active && (
                <span className="absolute -left-3 top-2 bottom-2 w-[3px] bg-spenza-orange-bright rounded-r-[3px]" />
              )}
              <Icon strokeWidth={1.75} className="w-[18px] h-[18px] shrink-0" />
              <span>{item.label}</span>
              {item.badge && (
                <span className="ml-auto bg-spenza-orange text-white text-[11px] font-semibold px-1.5 py-0.5 rounded-full mono">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-spenza-border-dark px-4 py-3.5 flex items-center gap-3">
        <div className="w-8 h-8 bg-spenza-orange rounded-full flex items-center justify-center text-[13px] font-semibold">
          AD
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-white leading-tight">admin</div>
          <div className="text-[11px] text-spenza-mute leading-tight">Operator</div>
        </div>
        <button
          aria-label="Sign out"
          onClick={signOut}
          className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center text-spenza-mute hover:bg-white/[0.06] hover:text-white transition-[background,color] duration-150"
        >
          <LogOut strokeWidth={1.75} className="w-[18px] h-[18px]" />
        </button>
      </div>
    </aside>
  );
}
