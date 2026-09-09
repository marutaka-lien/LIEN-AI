import { describe, expect, it } from "vitest";

import {
  buildPipelineStages,
  buildThroughputSeries,
  deriveOperationAlerts,
  formatJstHm,
  jstHour,
  niceCeiling,
} from "../operations-dashboard";

// 2026-09-09 12:00 JST = 2026-09-09 03:00 UTC
const NOON_JST = new Date("2026-09-09T03:00:00.000Z");
function atJstHour(hour: number, minute = 0): Date {
  return new Date(Date.UTC(2026, 8, 9, hour - 9, minute, 0));
}

describe("jstHour / formatJstHm", () => {
  it("UTC を +9 して時・分を出す", () => {
    expect(jstHour(new Date("2026-09-09T03:30:00.000Z"))).toBe(12);
    expect(formatJstHm(new Date("2026-09-09T03:05:00.000Z"))).toBe("12:05");
  });
});

describe("niceCeiling", () => {
  it("10以下は10", () => {
    expect(niceCeiling(0)).toBe(10);
    expect(niceCeiling(10)).toBe(10);
  });
  it("10超はステップぶん上に余白を取る", () => {
    expect(niceCeiling(11)).toBeGreaterThanOrEqual(15);
    expect(niceCeiling(34)).toBeGreaterThan(34);
  });
});

describe("buildThroughputSeries", () => {
  it("現在時が開始時より前なら hasData=false・空配列", () => {
    const early = new Date("2026-09-09T00:00:00.000Z"); // 09:00 JST ちょうど手前 (08:00 前提でずらす)
    const series = buildThroughputSeries([], [], { now: new Date(early.getTime() - 3600_000) });
    expect(series.hasData).toBe(false);
    expect(series.hours).toEqual([]);
  });

  it("受注・発送の累計を時間帯ごとに出し、現在時までで打ち切る", () => {
    const ordered = [atJstHour(9, 10), atJstHour(9, 40), atJstHour(11, 0)];
    const shipped = [atJstHour(10, 0)];
    const series = buildThroughputSeries(ordered, shipped, { now: NOON_JST });
    expect(series.hours).toEqual([9, 10, 11, 12]);
    expect(series.orderedCumulative).toEqual([2, 2, 3, 3]);
    expect(series.shippedCumulative).toEqual([0, 1, 1, 1]);
    expect(series.hasData).toBe(true);
    expect(series.yMax).toBe(10);
  });

  it("データが無ければ hasData=false", () => {
    const series = buildThroughputSeries([], [], { now: NOON_JST });
    expect(series.hasData).toBe(false);
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
