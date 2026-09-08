import iconv from "iconv-lite";
import { describe, expect, it } from "vitest";

import { decodeCsvBuffer, parseClickPostTrackingCsv } from "../clickpost-tracking-csv";

const HEADER = "追跡番号,お届け先郵便番号,お届け先氏名,お届け先敬称,お届け先住所,内容品";
const ROW1 = "621234567890,150-0001,山田 太郎,様,東京都渋谷区神宮前1-1-1,衣料品";
const ROW2 = "621234567891,151-0053,佐藤 花子,様,東京都渋谷区代々木2-2-2,衣料品";

describe("decodeCsvBuffer", () => {
  it("Shift_JIS のバッファを読める", () => {
    const buffer = iconv.encode(`${HEADER}\r\n${ROW1}\r\n`, "Shift_JIS");
    expect(decodeCsvBuffer(buffer)).toContain("山田 太郎");
  });

  it("UTF-8(BOM付き)のバッファを読める", () => {
    const buffer = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from(`${HEADER}\r\n${ROW1}\r\n`, "utf8"),
    ]);
    expect(decodeCsvBuffer(buffer)).toContain("山田 太郎");
  });
});

describe("parseClickPostTrackingCsv", () => {
  it("追跡番号・郵便番号・氏名・住所を取り出す(列順は問わない)", () => {
    const csv = [
      "内容品,お届け先住所,お届け先氏名,お届け先郵便番号,お問い合わせ番号",
      "衣料品,東京都渋谷区神宮前1-1-1,山田 太郎,150-0001,621234567890",
    ].join("\r\n");
    const result = parseClickPostTrackingCsv(iconv.encode(csv, "Shift_JIS"));
    expect(result.headerWarning).toBeUndefined();
    expect(result.rows).toEqual([
      {
        trackingNumber: "621234567890",
        postalCode: "150-0001",
        recipientName: "山田 太郎",
        address: "東京都渋谷区神宮前1-1-1",
        sourceRowNumber: 1,
      },
    ]);
  });

  it("複数行を行番号付きで返す", () => {
    const csv = [HEADER, ROW1, ROW2].join("\r\n");
    const result = parseClickPostTrackingCsv(iconv.encode(csv, "Shift_JIS"));
    expect(result.rows.map((r) => r.sourceRowNumber)).toEqual([1, 2]);
    expect(result.rows[1].trackingNumber).toBe("621234567891");
  });

  it("追跡番号や宛先が空の行は落として行番号を記録する", () => {
    const csv = [HEADER, ROW1, ",,,,,", "621234567892,150-0001,,様,東京都,衣料品"].join("\r\n");
    const result = parseClickPostTrackingCsv(iconv.encode(csv, "Shift_JIS"));
    expect(result.rows).toHaveLength(1);
    // 3行目(空カンマのみ)と4行目(氏名欠け)が落ちる。
    expect(result.droppedRowNumbers).toEqual([2, 3]);
  });

  it("必要な列が無ければ headerWarning を返し rows は空", () => {
    const csv = ["注文番号,金額", "x,y"].join("\r\n");
    const result = parseClickPostTrackingCsv(iconv.encode(csv, "Shift_JIS"));
    expect(result.rows).toHaveLength(0);
    expect(result.headerWarning).toContain("追跡番号");
  });
});
