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
        "flex items-center justify-between rounded-lg border p-5",
        emphasis === "error"
          ? "border-error-border bg-error-subtle"
          : "border-border-subtle bg-surface",
        wide && "sm:col-span-2"
      )}
    >
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={cn("font-mono text-2xl font-semibold tabular-nums", EMPHASIS_TEXT[emphasis])}>
          {value}
        </span>
      </div>
      <Icon className={cn("size-8", EMPHASIS_TEXT[emphasis])} aria-hidden />
    </div>
  );
}
