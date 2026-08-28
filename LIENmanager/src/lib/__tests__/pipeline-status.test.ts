import { describe, expect, it } from "vitest";

import { buildPipelineStages } from "../pipeline-status";
import type {
  AutomationJobDetailDTO,
  AutomationJobItemDetailDTO,
  AutomationStepDTO,
} from "@/types/automation";

function buildStep(overrides: Partial<AutomationStepDTO> = {}): AutomationStepDTO {
  return {
    id: `step-${Math.random()}`,
    stepKey: "rms_fetch",
    status: "success",
    retryCount: 0,
    errorMessage: null,
    startedAt: null,
    finishedAt: null,
    ...overrides,
  };
}

function buildItem(overrides: Partial<AutomationJobItemDetailDTO> = {}): AutomationJobItemDetailDTO {
  return {
    id: `item-${Math.random()}`,
    carrier: "clickpost",
    status: "success",
    trackingNumber: null,
    errorMessage: null,
    order: {
      id: "order-1",
      orderNumber: "R-0001",
      ordererName: "テスト太郎",
      recipientName: "テスト太郎",
      prefecture: "東京都",
      address1: "千代田区1-1",
    },
    steps: [],
    ...overrides,
  };
}

function buildJob(overrides: Partial<AutomationJobDetailDTO> = {}): AutomationJobDetailDTO {
  return {
    id: "job-1",
    moduleKey: "rakuten_clickpost",
    status: "running",
    totalCount: 0,
    successCount: 0,
    failureCount: 0,
    progressPercentage: 0,
    currentLabel: null,
    startedAt: null,
    finishedAt: null,
    createdAt: new Date().toISOString(),
    jobSteps: [],
    items: [],
    ...overrides,
  };
}

describe("buildPipelineStages", () => {
  it("常に5ステージ(実装3+未実装2)を返す", () => {
    const stages = buildPipelineStages(buildJob());
    expect(stages).toHaveLength(5);
    expect(stages.map((s) => s.key)).toEqual([
      "rms_fetch",
      "rms_order_confirm",
      "clickpost_register",
      "label_issue",
      "tracking_fetch",
    ]);
  });

  it("未実装ステージは常にimplemented:falseで、実データの影響を受けない", () => {
    const stages = buildPipelineStages(buildJob());
    const labelStage = stages.find((s) => s.key === "label_issue");
    const trackingStage = stages.find((s) => s.key === "tracking_fetch");
    expect(labelStage?.implemented).toBe(false);
    expect(trackingStage?.implemented).toBe(false);
  });

  it("jobStepsが空の場合、rms_fetchはpending", () => {
    const stages = buildPipelineStages(buildJob({ jobSteps: [] }));
    const fetchStage = stages.find((s) => s.key === "rms_fetch");
    expect(fetchStage).toMatchObject({ status: "pending", totalCount: 0 });
  });

  it("jobSteps(rms_fetch)がsuccessならステージもsuccess", () => {
    const stages = buildPipelineStages(
      buildJob({ jobSteps: [buildStep({ stepKey: "rms_fetch", status: "success" })] })
    );
    expect(stages.find((s) => s.key === "rms_fetch")).toMatchObject({
      status: "success",
      totalCount: 1,
    });
  });

  it("全itemのrms_order_confirmがskippedなら集約もskipped", () => {
    const items = [
      buildItem({ steps: [buildStep({ stepKey: "rms_order_confirm", status: "skipped" })] }),
      buildItem({ steps: [buildStep({ stepKey: "rms_order_confirm", status: "skipped" })] }),
    ];
    const stages = buildPipelineStages(buildJob({ items }));
    expect(stages.find((s) => s.key === "rms_order_confirm")).toMatchObject({
      status: "skipped",
      totalCount: 2,
    });
  });

  it("一部のclickpost_registerがfailedなら集約はfailedになり件数を保持する", () => {
    const items = [
      buildItem({ steps: [buildStep({ stepKey: "clickpost_register", status: "failed" })] }),
      buildItem({ steps: [buildStep({ stepKey: "clickpost_register", status: "failed" })] }),
      buildItem({ steps: [buildStep({ stepKey: "clickpost_register", status: "success" })] }),
    ];
    const stages = buildPipelineStages(buildJob({ items }));
    expect(stages.find((s) => s.key === "clickpost_register")).toMatchObject({
      status: "failed",
      failedCount: 2,
      totalCount: 3,
    });
  });

  it("いずれかのstepがrunningなら、failedが混在していてもrunning優先", () => {
    const items = [
      buildItem({ steps: [buildStep({ stepKey: "clickpost_register", status: "running" })] }),
      buildItem({ steps: [buildStep({ stepKey: "clickpost_register", status: "failed" })] }),
    ];
    const stages = buildPipelineStages(buildJob({ items }));
    const stage = stages.find((s) => s.key === "clickpost_register");
    expect(stage?.implemented && stage.status).toBe("running");
  });
});
