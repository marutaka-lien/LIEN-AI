import { cn } from "@/lib/utils";
import type { ProductState } from "@/types/product";

const STATE_STYLES: Record<ProductState, string> = {
  公開中: "bg-success-subtle text-success-foreground border-success-border",
  公開予約: "bg-primary-subtle text-primary border-primary-border",
  在庫注意: "bg-warning-subtle text-warning-foreground border-warning-border",
  下書き: "bg-surface-hover text-text-secondary border-border-subtle",
};

export function ProductStateBadge({
  state,
  className,
}: {
  state: ProductState;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        STATE_STYLES[state],
        className
      )}
    >
      {state}
    </span>
  );
}
