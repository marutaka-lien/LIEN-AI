import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type KPIEmphasis = "neutral" | "success" | "error" | "running";

const EMPHASIS_TEXT: Record<KPIEmphasis, string> = {
  neutral: "text-foreground",
  success: "text-success-foreground",
  error: "text-error-foreground",
  running: "text-primary",
};

export function KPICard({
  label,
  value,
  icon: Icon,
  emphasis = "neutral",
  wide = false,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  emphasis?: KPIEmphasis;
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        "group relative flex min-h-32 items-center justify-between overflow-hidden rounded-2xl border p-5 transition duration-200 hover:-translate-y-0.5 hover:border-border-strong",
        emphasis === "error"
          ? "border-error-border bg-error-subtle"
          : "border-border-subtle bg-surface",
        wide && "sm:col-span-2"
      )}
    >
      <div className="relative z-10 flex flex-col gap-2">
        <span className="text-xs font-medium tracking-wide text-muted-foreground">{label}</span>
        <span className={cn("font-mono text-3xl font-semibold tabular-nums tracking-tight", EMPHASIS_TEXT[emphasis])}>
          {value}
        </span>
      </div>
      <div className={cn("flex size-11 items-center justify-center rounded-xl bg-background/40", EMPHASIS_TEXT[emphasis])}><Icon className="size-5" aria-hidden /></div>
      <div className={cn("absolute -bottom-12 -right-10 size-28 rounded-full opacity-10 blur-2xl", emphasis === "error" ? "bg-error-foreground" : "bg-primary")} />
    </div>
  );
}
