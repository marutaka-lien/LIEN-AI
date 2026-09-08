import iconv from "iconv-lite";
import { describe, expect, it } from "vitest";

import {
  buildShippingReportCsvBuffer,
  buildShippingReportCsvFilename,
  buildShippingReportCsvText,
  findUnsafeTrackingNumbers,
} from "../upload-csv";
import type { ShippingReportCsvRow } from "../rms-shipping-report-types";

function row(overrides: Partial<ShippingReportCsvRow> = {}): ShippingReportCsvRow {
  return {
    orderNumber: "333267-20260901-0000000001",
    shippingTrackingNumber: "621234567890",
    deliveryCompany: "1003",
    shippingDate: "2026-09-08",
    ...overrides,
  };
}

describe("buildShippingReportCsvText", () => {
  it("6列固定・ヘッダー付き・送付先ID/発送明細IDは空欄", () => {
    const text = buildShippingReportCsvText([row()]);
    const lines = text.split("\r\n");
    expect(lines[0]).toBe("注文番号,送付先ID,発送明細ID,お荷物伝票番号,配送会社,発送日");
    expect(lines[1]).toBe("333267-20260901-0000000001,,,621234567890,1003,2026-09-08");
  });

  it("行が無くてもヘッダーだけは出す", () => {
    expect(buildShippingReportCsvText([])).toBe(
      "注文番号,送付先ID,発送明細ID,お荷物伝票番号,配送会社,発送日"
    );
  });
});

describe("buildShippingReportCsvBuffer", () => {
  it("Shift-JIS でエンコードされ、読み戻せる", () => {
    const buffer = buildShippingReportCsvBuffer([row()]);
    const decoded = iconv.decode(buffer, "Shift_JIS");
    expect(decoded).toContain("お荷物伝票番号");
    expect(decoded).toContain("621234567890");
  });
});

describe("buildShippingReportCsvFilename", () => {
  it("ASCII のみでタイムスタンプ付き", () => {
    const name = buildShippingReportCsvFilename(new Date("2026-09-08T02:03:04Z"));
    expect(name).toMatch(/^rms_shipping_report_20260908_110304\.csv$/);
  });
});

describe("findUnsafeTrackingNumbers", () => {
  it("12桁数字の追跡番号は安全(空配列)", () => {
    expect(findUnsafeTrackingNumbers([row()])).toEqual([]);
  });

  it("Shift-JIS に無い文字を含む追跡番号を検出する", () => {
    const unsafe = findUnsafeTrackingNumbers([row({ shippingTrackingNumber: "62123456789😀" })]);
    expect(unsafe).toHaveLength(1);
    expect(unsafe[0].orderNumber).toBe("333267-20260901-0000000001");
  });
});
