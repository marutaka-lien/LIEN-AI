import type { AutomationJobDetailDTO, AutomationStepDTO } from "@/types/automation";

// Automation画面のPipeline Visualization用の集約ロジック(クライアント側の表示集約のみ、
// API/DTOの変更は行わない)。
//
// stepKeyの文字列値は src/server/automations/rms-clickpost/automation-module.ts の
// STEP_KEY定数と対応する。UI層はserver層のモジュールに直接依存しない方針のため、
// ここで独立して定義している(値がずれた場合はVitestで検知できる)。
const STAGE_DEFINITIONS = [
  { key: "rms_fetch", label: "注文取得", scope: "job" as const },
  { key: "rms_order_confirm", label: "注文確認", scope: "item" as const },
  { key: "clickpost_register", label: "配送登録", scope: "item" as const },
] as const;

// 未実装ステージ。対応するstepKeyはDB上に存在しないため、実データの判定ロジックには
// 一切含めず、常に固定表示する(実装済みのように見せないための明示的な区別)。
export const NOT_IMPLEMENTED_STAGES = [
  { key: "label_issue", label: "ラベル取得" },
  { key: "tracking_fetch", label: "追跡番号取得" },
] as const;

export type PipelineStageStatus = "pending" | "running" | "success" | "failed" | "skipped";

export interface PipelineStageView {
  key: string;
  label: string;
  status: PipelineStageStatus;
  failedCount: number;
  totalCount: number;
  implemented: true;
}

export interface NotImplementedStageView {
  key: string;
  label: string;
  implemented: false;
}

export type AnyStageView = PipelineStageView | NotImplementedStageView;

function aggregateStepStatus(steps: AutomationStepDTO[]): PipelineStageStatus {
  if (steps.length === 0) return "pending";
  if (steps.some((step) => step.status === "running")) return "running";
  if (steps.some((step) => step.status === "failed")) return "failed";
  if (steps.every((step) => step.status === "skipped")) return "skipped";
  if (steps.every((step) => step.status === "success" || step.status === "skipped")) {
    return "success";
  }
  return "pending";
}

export function buildPipelineStages(job: AutomationJobDetailDTO): AnyStageView[] {
  const implementedStages: PipelineStageView[] = STAGE_DEFINITIONS.map((definition) => {
    const steps =
      definition.scope === "job"
        ? job.jobSteps.filter((step) => step.stepKey === definition.key)
        : job.items.flatMap((item) => item.steps.filter((step) => step.stepKey === definition.key));

    return {
      key: definition.key,
      label: definition.label,
      status: aggregateStepStatus(steps),
      failedCount: steps.filter((step) => step.status === "failed").length,
      totalCount: steps.length,
      implemented: true,
    };
  });

  const notImplementedStages: NotImplementedStageView[] = NOT_IMPLEMENTED_STAGES.map((stage) => ({
    ...stage,
    implemented: false,
  }));

  return [...implementedStages, ...notImplementedStages];
}
