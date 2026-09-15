import { describe, expect, it } from "vitest";

import {
  buildSalesBars,
  computeChange,
  formatPeriod,
  formatYen,
  latestWeek,
} from "../weekly-sales-view";
import type { WeeklySalesRecord } from "@/server/sales/weekly-sales.service";

function buildRecord(overrides: Partial<WeeklySalesRecord> = {}): WeeklySalesRecord {
  return {
    periodStart: "2026-08-17",
    periodEnd: "2026-08-23",
    salesYen: 133333,
    orders: 23,
    qty: 32,
    avgOrderYen: 5797,
    avgQty: 1.39,
    recordedAt: "2026-08-29",
    note: "",
    ...overrides,
  };
}

describe("latestWeek", () => {
  it("配列の最後の要素(記録順で最新週)を返す", () => {
    const records = [buildRecord({ periodStart: "2026-08-17" }), buildRecord({ periodStart: "2026-08-24" })];
    expect(latestWeek(records)?.periodStart).toBe("2026-08-24");
  });

  it("空配列ならnull", () => {
    expect(latestWeek([])).toBeNull();
  });
});

describe("computeChange", () => {
  it("2週分あれば前週比を計算する", () => {
    const records = [
      buildRecord({ salesYen: 100000 }),
      buildRecord({ salesYen: 150000 }),
    ];
    const change = computeChange(records);
    expect(change.deltaYen).toBe(50000);
    expect(change.deltaPercent).toBe(50);
  });

  it("1週分しか無ければnull(捏造しない)", () => {
    expect(computeChange([buildRecord()])).toEqual({ deltaYen: null, deltaPercent: null });
  });

  it("前週の売上が0ならdeltaPercentはnull", () => {
    const records = [buildRecord({ salesYen: 0 }), buildRecord({ salesYen: 1000 })];
    expect(computeChange(records).deltaPercent).toBeNull();
  });
});

describe("formatYen / formatPeriod", () => {
  it("3桁区切りで円を付ける", () => {
    expect(formatYen(154620)).toBe("154,620円");
  });

  it("月/日〜月/日の形にする", () => {
    expect(formatPeriod(buildRecord({ periodStart: "2026-09-07", periodEnd: "2026-09-13" }))).toBe(
      "09/07〜09/13"
    );
  });
});

describe("buildSalesBars", () => {
  it("直近maxWeeks件だけ切り出し、最大売上を100%とした高さ比率を付ける", () => {
    const records = [
      buildRecord({ periodStart: "2026-08-17", salesYen: 50000 }),
      buildRecord({ periodStart: "2026-08-24", salesYen: 100000 }),
    ];
    const bars = buildSalesBars(records, 1);
    expect(bars).toHaveLength(1);
    expect(bars[0].record.periodStart).toBe("2026-08-24");
    expect(bars[0].heightPercent).toBe(100);
  });

  it("売上0の週でも最低限の高さ(4%)を確保する", () => {
    const bars = buildSalesBars([buildRecord({ salesYen: 0 })]);
    expect(bars[0].heightPercent).toBe(4);
  });
});
