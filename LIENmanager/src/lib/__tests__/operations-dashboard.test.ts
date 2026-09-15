import { describe, expect, it } from "vitest";

import { buildPipelineStages, deriveOperationAlerts, formatJstHm } from "../operations-dashboard";

describe("formatJstHm", () => {
  it("UTC を +9 して時・分を出す", () => {
    expect(formatJstHm(new Date("2026-09-09T03:05:00.000Z"))).toBe("12:05");
  });
});

describe("buildPipelineStages", () => {
  it("途中2段のうち最大の段だけを滞留として強調する", () => {
    const stages = buildPipelineStages({
      awaitingConfirm: 3,
      pendingShip: 12,
      csvExported: 8,
      shippedToday: 20,
    });
    expect(stages.map((s) => s.key)).toEqual(["confirm", "await_ship", "csv_exported", "shipped"]);
    expect(stages.find((s) => s.key === "await_ship")?.bottleneck).toBe(true);
    expect(stages.filter((s) => s.bottleneck)).toHaveLength(1);
  });

  it("途中2段が両方0なら滞留は無し", () => {
    const stages = buildPipelineStages({
      awaitingConfirm: 0,
      pendingShip: 0,
      csvExported: 0,
      shippedToday: 5,
    });
    expect(stages.some((s) => s.bottleneck)).toBe(false);
  });
});

describe("deriveOperationAlerts", () => {
  it("注文確認待ちがあれば1件のアラート", () => {
    expect(deriveOperationAlerts({ awaitingConfirm: 2 })).toEqual([
      { key: "awaiting_confirm", label: "注文確認待ちの注文があります", count: 2, href: "/automation" },
    ]);
  });
  it("0なら空", () => {
    expect(deriveOperationAlerts({ awaitingConfirm: 0 })).toEqual([]);
  });
});
