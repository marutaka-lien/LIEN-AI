import type { CSSProperties } from "react";

import { AnimatedNumber } from "@/components/ui/animated-number";
import { cn } from "@/lib/utils";
import type { PipelineStage } from "@/lib/operations-dashboard";

/**
 * 出荷の流れ（4段の現在件数）。ファネルではなく同じ幅で並べ、段の間を「流れる線」でつなぐ。
 * 各段の下のバー＝その段の件数を4段中の最大値で割った長さ（段どうしの比較用）。
 * 滞留段は1つだけ warning で強調する。
 */
export function ShippingPipeline({ stages }: { stages: PipelineStage[] }) {
  const max = Math.max(1, ...stages.map((stage) => stage.count));
  const bottleneck = stages.find((stage) => stage.bottleneck);
  const summary = stages.map((stage) => `${stage.label}${stage.count}件`).join("、");

  return (
    <section
      className="glass lg-rise rounded-2xl px-5 pb-5 pt-6"
      style={{ "--delay": "260ms" } as CSSProperties}
      aria-label={`出荷の流れ：${summary}${bottleneck ? `。滞留は${bottleneck.label}` : ""}`}
    >
      <div className="relative grid grid-cols-4 gap-2">
        {/* 段の中心どうしを結ぶ流れる線（左右は端の段の中心で止める） */}
        <svg
          className="pointer-events-none absolute inset-x-[12.5%] top-7 h-px w-3/4 overflow-visible"
          viewBox="0 0 100 1"
          preserveAspectRatio="none"
          aria-hidden
        >
          <line x1="0" y1="0.5" x2="100" y2="0.5" stroke="oklch(0.235 0.018 262 / 10%)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          <line
            x1="0"
            y1="0.5"
            x2="100"
            y2="0.5"
            stroke="var(--accent-cyan)"
            strokeWidth="2"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            className="lg-flow"
          />
        </svg>

        {stages.map((stage, index) => {
          const delay = 320 + index * 90;
          return (
            <div key={stage.key} className="relative flex flex-col items-center text-center">
              <div
                className={cn(
                  "lg-pop relative flex size-14 items-center justify-center rounded-full border text-xl font-semibold tracking-tight",
                  stage.bottleneck
                    ? "border-warning-border bg-[oklch(0.97_0.03_70)] text-warning-foreground shadow-[0_0_0_6px_oklch(0.54_0.125_62/10%)]"
                    : "border-white bg-white shadow-[inset_0_1px_0_oklch(1_0_0),0_6px_16px_-8px_oklch(0.235_0.018_262/30%)]"
                )}
                style={{ "--delay": `${delay}ms` } as CSSProperties}
              >
                <AnimatedNumber value={stage.count} delay={delay} />
              </div>
              <span
                className={cn(
                  "mt-2.5 text-xs font-medium",
                  stage.bottleneck ? "text-warning-foreground" : "text-text-secondary"
                )}
              >
                {stage.label}
              </span>
              <span className="mt-1 h-4 text-[0.65rem] font-semibold text-warning-foreground">
                {stage.bottleneck ? "滞留" : ""}
              </span>
              <div className="mt-1 h-1 w-full max-w-24 overflow-hidden rounded-full bg-[oklch(0.235_0.018_262/6%)]">
                <div
                  className={cn(
                    "lg-grow-x h-full rounded-full",
                    stage.bottleneck ? "bg-warning-foreground" : "bg-accent-cyan"
                  )}
                  style={{ width: `${(stage.count / max) * 100}%`, "--delay": `${delay + 120}ms` } as CSSProperties}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
