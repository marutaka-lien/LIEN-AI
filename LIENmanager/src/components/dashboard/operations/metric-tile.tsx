import { ArrowUpRight } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";

import { AnimatedNumber } from "@/components/ui/animated-number";
import { cn } from "@/lib/utils";

type Dot = "warning" | "cyan" | "success" | "neutral";

const DOT_CLASS: Record<Dot, string> = {
  warning: "bg-warning-foreground",
  cyan: "bg-accent-cyan",
  success: "bg-success-foreground",
  neutral: "bg-muted-foreground",
};

/**
 * 主要指標の1タイル。色ドット＋必ず文字ラベル / カウントアップする大きな数値 / 一言メタ。
 * visual＝数値の右に置く小さな図（リング等）、bar＝数値の下に横幅いっぱいで置く内訳バー。
 * タイル全体がリンク（押せる面を広く取る）。
 */
export function MetricTile({
  label,
  value,
  unit = "件",
  meta,
  href,
  linkLabel,
  dot = "neutral",
  visual,
  bar,
  delay = 0,
}: {
  label: string;
  value: number;
  unit?: string;
  meta?: string;
  href: string;
  linkLabel: string;
  dot?: Dot;
  visual?: ReactNode;
  bar?: ReactNode;
  delay?: number;
}) {
  return (
    <Link
      href={href}
      aria-label={`${label} ${value}${unit}。${linkLabel}`}
      className="glass lg-rise lg-press group flex min-h-36 flex-col rounded-2xl p-5"
      style={{ "--delay": `${delay}ms` } as CSSProperties}
    >
      <div className="flex items-center gap-2">
        <span className={cn("size-1.5 shrink-0 rounded-full", DOT_CLASS[dot])} aria-hidden />
        <span className="text-xs font-medium text-text-secondary">{label}</span>
        <ArrowUpRight
          className="ml-auto size-4 text-text-disabled transition-[color,transform] duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary"
          aria-hidden
        />
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="whitespace-nowrap text-[2.1rem] font-semibold leading-none tracking-tight">
          <AnimatedNumber value={value} delay={delay} />
          <span className="ml-1 text-sm font-normal text-text-secondary">{unit}</span>
        </div>
        {visual}
      </div>
      {bar && <div className="mt-3">{bar}</div>}
      {meta && <p className="mt-auto pt-3 text-xs text-text-secondary">{meta}</p>}
    </Link>
  );
}
