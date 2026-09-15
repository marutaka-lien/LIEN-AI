import { describe, expect, it } from "vitest";

import { parseWeeklySalesCsv } from "../weekly-sales.service";

describe("parseWeeklySalesCsv", () => {
  it("ヘッダーを除き、各行をレコードへ変換する", () => {
    const csv = [
      "期間開始日,期間終了日,売上円,注文件数,販売個数,1注文あたり売上円,1注文あたり個数,取得日,備考",
      "2026-08-17,2026-08-23,133333,23,32,5797,1.39,2026-08-29,テスト備考",
    ].join("\n");

    const records = parseWeeklySalesCsv(csv);

    expect(records).toEqual([
      {
        periodStart: "2026-08-17",
        periodEnd: "2026-08-23",
        salesYen: 133333,
        orders: 23,
        qty: 32,
        avgOrderYen: 5797,
        avgQty: 1.39,
        recordedAt: "2026-08-29",
        note: "テスト備考",
      },
    ]);
  });

  it("期間開始日の昇順に並べ替える(記録順が前後していても)", () => {
    const csv = [
      "期間開始日,期間終了日,売上円,注文件数,販売個数,1注文あたり売上円,1注文あたり個数,取得日,備考",
      "2026-09-07,2026-09-13,1,1,1,1,1,2026-09-15,",
      "2026-08-17,2026-08-23,1,1,1,1,1,2026-08-29,",
    ].join("\n");

    const records = parseWeeklySalesCsv(csv);

    expect(records.map((r) => r.periodStart)).toEqual(["2026-08-17", "2026-09-07"]);
  });

  it("備考にカンマが含まれる行も読み飛ばさず結合する", () => {
    const csv = [
      "期間開始日,期間終了日,売上円,注文件数,販売個数,1注文あたり売上円,1注文あたり個数,取得日,備考",
      "2026-08-17,2026-08-23,1,1,1,1,1,2026-08-29,備考1,備考2",
    ].join("\n");

    const records = parseWeeklySalesCsv(csv);

    expect(records[0].note).toBe("備考1,備考2");
  });

  it("空文字列なら空配列", () => {
    expect(parseWeeklySalesCsv("")).toEqual([]);
  });

  it("ヘッダーのみなら空配列", () => {
    const csv = "期間開始日,期間終了日,売上円,注文件数,販売個数,1注文あたり売上円,1注文あたり個数,取得日,備考";
    expect(parseWeeklySalesCsv(csv)).toEqual([]);
  });
});
