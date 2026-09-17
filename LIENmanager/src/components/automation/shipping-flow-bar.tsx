"use client";

import type { ReactNode } from "react";
import { Archive, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { SHIPPING_SEGMENT_LABELS } from "@/lib/shipping-segments";
import type { ShippingSegment, ShippingSegmentCounts } from "@/types/order";

// 発送エントリー「作業メニュー」の上部フローバー。確認待ち→未処理→作業中→処理済みが
// 基本の流れ、一時保存・対象外は区切りを空けて右端に置く(Claude Design v2モック準拠、
// 対象外は2026-09-15マスター指示で一時保存の隣に追加)。
const FLOW_SEGMENTS: { segment: ShippingSegment; dotClassName: string }[] = [
  { segment: "awaiting", dotClassName: "bg-status-skipped" },
  { segment: "unprocessed", dotClassName: "bg-warning-foreground" },
  { segment: "inProgress", dotClassName: "bg-primary" },
  { segment: "done", dotClassName: "bg-success-foreground" },
];

export function ShippingFlowBar({
  counts,
  active,
  onChange,
}: {
  counts: ShippingSegmentCounts | null;
  active: ShippingSegment;
  onChange: (segment: ShippingSegment) => void;
}) {
  return (
    <div className="flex items-stretch gap-2">
      <div className="flex flex-1 items-stretch gap-1.5 overflow-x-auto">
        {FLOW_SEGMENTS.map(({ segment, dotClassName }, index) => (
          <SegmentButton
            key={segment}
            active={active === segment}
            dotClassName={dotClassName}
            label={SHIPPING_SEGMENT_LABELS[segment]}
            count={counts?.[segment] ?? null}
            onClick={() => onChange(segment)}
            trailingArrow={index < FLOW_SEGMENTS.length - 1}
          />
        ))}
      </div>
      <span className="w-px shrink-0 bg-border-subtle" aria-hidden />
      <SegmentButton
        active={active === "held"}
        icon={<Archive className="size-[13px] text-muted-foreground" aria-hidden />}
        label={SHIPPING_SEGMENT_LABELS.held}
        count={counts?.held ?? null}
        onClick={() => onChange("held")}
        className="w-[150px] shrink-0"
      />
      <SegmentButton
        active={active === "excluded"}
        icon={<Trash2 className="size-[13px] text-muted-foreground" aria-hidden />}
        label={SHIPPING_SEGMENT_LABELS.excluded}
        count={counts?.excluded ?? null}
        onClick={() => onChange("excluded")}
        className="w-[150px] shrink-0"
      />
    </div>
  );
}

function SegmentButton({
  active,
  label,
  count,
  onClick,
  dotClassName,
  icon,
  trailingArrow,
  className,
}: {
  active: boolean;
  label: string;
  count: number | null;
  onClick: () => void;
  dotClassName?: string;
  icon?: ReactNode;
  trailingArrow?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-[66px] min-w-[128px] flex-1 shrink-0 flex-col justify-between gap-1.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
        active
          ? "border-border-strong bg-surface-elevated shadow-[inset_0_1px_0_oklch(1_0_0/6%)]"
          : "border-border-subtle bg-transparent hover:bg-surface",
        className
      )}
    >
      <span className="flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-foreground">
        {icon ?? <span className={cn("size-1.5 shrink-0 rounded-full", dotClassName)} />}
        {label}
        {trailingArrow && (
          <span className="ml-auto text-text-disabled" aria-hidden>
            ›
          </span>
        )}
      </span>
      <span className="flex items-baseline gap-1">
        <span className="font-mono text-xl font-semibold tabular-nums tracking-tight">
          {count ?? "—"}
        </span>
        <span className="text-[11px] text-muted-foreground">件</span>
      </span>
    </button>
  );
}
