import { describe, expect, it } from "vitest";

import { deriveHeroState } from "../dashboard-status";
import type { AutomationJobSummaryDTO, DashboardSummaryDTO } from "@/types/automation";

function buildJob(overrides: Partial<AutomationJobSummaryDTO> = {}): AutomationJobSummaryDTO {
  return {
    id: "job-1",
    moduleKey: "rakuten_clickpost",
    status: "success",
    totalCount: 5,
    successCount: 5,
    failureCount: 0,
    progressPercentage: 100,
    currentLabel: null,
    startedAt: null,
    finishedAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function buildSummary(overrides: Partial<DashboardSummaryDTO> = {}): DashboardSummaryDTO {
  return {
    processedCount: 0,
    successCount: 0,
    failureCount: 0,
    runningJobCount: 0,
    latestJob: null,
    ...overrides,
  };
}

describe("deriveHeroState", () => {
  it("runningJobCount > 0 の場合は他の値に関わらずrunning", () => {
    const summary = buildSummary({
      runningJobCount: 1,
      latestJob: buildJob({ status: "failed" }),
    });
    expect(deriveHeroState(summary)).toBe("running");
  });

  it("latestJobがnullの場合はno_data", () => {
    expect(deriveHeroState(buildSummary({ runningJobCount: 0, latestJob: null }))).toBe("no_data");
  });

  it("latestJob.status === failed の場合はfailed", () => {
    const summary = buildSummary({ latestJob: buildJob({ status: "failed" }) });
    expect(deriveHeroState(summary)).toBe("failed");
  });

  it("latestJob.status === stopped の場合はstopped", () => {
    const summary = buildSummary({ latestJob: buildJob({ status: "stopped" }) });
    expect(deriveHeroState(summary)).toBe("stopped");
  });

  it("latestJob.status === success の場合はidle", () => {
    const summary = buildSummary({ latestJob: buildJob({ status: "success" }) });
    expect(deriveHeroState(summary)).toBe("idle");
  });

  it("latestJob.status === pending の場合もidleとして扱う", () => {
    const summary = buildSummary({ latestJob: buildJob({ status: "pending" }) });
    expect(deriveHeroState(summary)).toBe("idle");
  });
});
