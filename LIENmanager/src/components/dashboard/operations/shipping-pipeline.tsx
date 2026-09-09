import { ChevronRight } from "lucide-react";
import { Fragment } from "react";

import { cn } from "@/lib/utils";
import type { PipelineStage } from "@/lib/operations-dashboard";

/**
 * 「出荷パイプライン」。C案モック準拠:
 * 4段の「現在の件数」を同じ幅で並べる（ファネルではない）。滞留段を1つだけ warning で強調。
 */
export function ShippingPipeline({ stages }: { stages: PipelineStage[] }) {
  const bottleneck = stages.find((stage) => stage.bottleneck);

  return (
    <section className="rounded-xl border border-border-subtle bg-surface-elevated p-4">
      <h3 className="mb-3 font-mono text-xs font-semibold tracking-wide text-text-secondary">
        出荷パイプライン
      </h3>
      <div className="flex items-stretch gap-1">
        {stages.map((stage, index) => (
          <Fragment key={stage.key}>
            {index > 0 && (
              <div className="flex items-center text-muted-foreground" aria-hidden>
                <ChevronRight className="size-3.5" />
              </div>
            )}
            <div
              className={cn(
                "flex-1 rounded-lg border p-3",
                stage.bottleneck
                  ? "border-warning-border bg-warning-subtle"
                  : "border-border-subtle bg-surface"
              )}
            >
              <div className="mb-2 flex items-center gap-1.5">
                <span
                  className={cn(
                    "font-mono text-[0.7rem] tracking-wide",
                    stage.bottleneck ? "text-warning-foreground" : "text-text-secondary"
                  )}
                >
                  {stage.label}
                </span>
                {stage.bottleneck && (
                  <span className="rounded bg-warning-foreground px-1.5 text-[0.6rem] font-semibold text-background">
                    滞留
                  </span>
                )}
              </div>
              <div className="font-mono text-2xl font-semibold leading-none tabular-nums">
                {stage.count}
              </div>
            </div>
          </Fragment>
        ))}
      </div>
      <p className="mt-3 text-[0.7rem] text-muted-foreground">
        同じ幅で比較。滞留＝{bottleneck ? bottleneck.label : "なし"}
      </p>
    </section>
  );
}
