import Link from "next/link";

import { cn } from "@/lib/utils";

type Dot = "warning" | "cyan" | "success" | "neutral";

const DOT_CLASS: Record<Dot, string> = {
  warning: "bg-warning-foreground",
  cyan: "bg-accent-cyan",
  success: "bg-success-foreground",
  neutral: "bg-muted-foreground",
};

/**
 * 「主要指標（現在値）」の1タイル。C案モック準拠:
 * 色ドット＋必ず文字ラベル / 大きな等幅数値 / 一言メタ / リンク。
 */
export function MetricTile({
  label,
  value,
  unit = "件",
  meta,
  href,
  linkLabel,
  dot = "neutral",
}: {
  label: string;
  value: number;
  unit?: string;
  meta?: string;
  href: string;
  linkLabel: string;
  dot?: Dot;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-border-subtle bg-surface-elevated p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className={cn("size-1.5 shrink-0 rounded-full", DOT_CLASS[dot])} aria-hidden />
        <span className="font-mono text-[0.7rem] tracking-wide text-text-secondary">{label}</span>
      </div>
      <div className="font-mono text-3xl font-semibold leading-none tracking-tight tabular-nums">
        {value}
        <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>
      </div>
      {meta && <p className="mt-2 text-xs text-text-secondary">{meta}</p>}
      <Link href={href} className="mt-2 text-xs font-medium text-primary hover:underline">
        {linkLabel} →
      </Link>
    </div>
  );
}
