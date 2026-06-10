import { cn } from "@/lib/cn";

export function LiveDot({ className, size = "md" }: { className?: string; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "w-2 h-2" : "w-2.5 h-2.5";
  return (
    <span className={cn("relative inline-block bg-spenza-orange-bright rounded-full shrink-0", dim, className)}>
      <span
        className={cn(
          "absolute rounded-full border-2 border-spenza-orange-bright animate-pulse-ring opacity-0",
          size === "sm" ? "-inset-[3px] border" : "-inset-1",
        )}
        style={size === "sm" ? { borderWidth: "1.5px" } : undefined}
      />
    </span>
  );
}
