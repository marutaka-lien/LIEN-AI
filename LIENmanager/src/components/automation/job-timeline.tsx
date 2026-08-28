import { Badge } from "@/components/ui/badge";
import { STEP_STATUS_BADGE } from "@/lib/automation-status";
import { cn } from "@/lib/utils";
import type { AutomationStepDTO } from "@/types/automation";

const STEP_LABELS: Record<string, string> = {
  rms_fetch: "注文取得",
  rms_order_confirm: "注文確認",
  clickpost_register: "配送登録",
};

export function JobTimeline({ steps }: { steps: AutomationStepDTO[] }) {
  if (steps.length === 0) return null;

  return (
    <ol className="flex flex-col">
      {steps.map((step, index) => {
        const badge = STEP_STATUS_BADGE[step.status];
        const isLast = index === steps.length - 1;

        return (
          <li key={step.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full",
                  badge.className
                )}
              >
                <badge.icon className="size-2.5" aria-hidden />
              </span>
              {!isLast && (
                <span
                  className={cn(
                    "w-px flex-1",
                    step.status === "skipped" || step.status === "pending"
                      ? "border-l border-dashed border-border-subtle"
                      : "bg-border"
                  )}
                  style={{ minHeight: "1.25rem" }}
                />
              )}
            </div>
            <div className="flex flex-1 flex-col gap-0.5 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">{STEP_LABELS[step.stepKey] ?? step.stepKey}</span>
                <Badge variant="outline" className={cn("gap-1 border-transparent", badge.className)}>
                  {badge.label}
                </Badge>
              </div>
              {step.errorMessage && (
                <span className="text-xs text-error-foreground">{step.errorMessage}</span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
