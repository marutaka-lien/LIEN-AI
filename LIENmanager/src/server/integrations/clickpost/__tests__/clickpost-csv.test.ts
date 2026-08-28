import iconv from "iconv-lite";
import { describe, expect, it } from "vitest";

import { buildClickPostCsvBuffer, buildClickPostCsvText } from "../clickpost-csv";
import type { ClickPostCsvRow } from "../clickpost-types";

function buildRow(overrides: Partial<ClickPostCsvRow> = {}): ClickPostCsvRow {
  return {
    postalCode: "1500001",
    recipientName: "山田 太郎",
    honorific: "様",
    addressLine1: "東京都渋谷区神宮前1-1-1",
    addressLine2: "",
    addressLine3: "",
    addressLine4: "",
    contents: "Tシャツ",
    ...overrides,
  };
}

describe("buildClickPostCsvText", () => {
  it("ヘッダー行と実際のプロジェクトCSVのヘッダーが一致する", () => {
    const text = buildClickPostCsvText([]);
    const [header] = text.split("\r\n");
    expect(header).toBe(
      "お届け先郵便番号,お届け先氏名,お届け先敬称,お届け先住所1行目,お届け先住所2行目,お届け先住所3行目,お届け先住所4行目,内容品"
    );
  });

  it("行データを正しくCSV化する", () => {
    const text = buildClickPostCsvText([buildRow()]);
    const lines = text.split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe("1500001,山田 太郎,様,東京都渋谷区神宮前1-1-1,,,,Tシャツ");
  });

  it("カンマを含む値はダブルクォートでエスケープする", () => {
    const text = buildClickPostCsvText([buildRow({ contents: "シャツ,タオル" })]);
    const [, row] = text.split("\r\n");
    expect(row).toContain('"シャツ,タオル"');
  });
});

describe("buildClickPostCsvBuffer", () => {
  it("Shift_JISでエンコードされ、デコードすると元のテキストと一致する", () => {
    const rows = [buildRow()];
    const buffer = buildClickPostCsvBuffer(rows);
    const decoded = iconv.decode(buffer, "Shift_JIS");

    expect(decoded).toBe(buildClickPostCsvText(rows));
  });
});
