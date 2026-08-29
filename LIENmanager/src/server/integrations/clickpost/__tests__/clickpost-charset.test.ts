import iconv from "iconv-lite";
import { describe, expect, it } from "vitest";

import { findUnmappableCp932Chars, normalizeForClickPostCsv } from "../clickpost-charset";
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
    contents: "衣料品",
    ...overrides,
  };
}

describe("normalizeForClickPostCsv", () => {
  it("CP932で「?」化・別グリフ化するダッシュ・マイナス類を半角ハイフンへ寄せる", () => {
    const dashLike = [0x00ad, 0x2010, 0x2011, 0x2012, 0x2013, 0x2014, 0x2015, 0x2212];
    for (const codePoint of dashLike) {
      const input = `1${String.fromCodePoint(codePoint)}2`;
      expect(normalizeForClickPostCsv(input)).toBe("1-2");
    }
  });

  it("波ダッシュ U+301C は意味を保つため全角チルダ U+FF5E へ寄せる", () => {
    const input = `10${String.fromCodePoint(0x301c)}12`;
    expect(normalizeForClickPostCsv(input)).toBe(`10${String.fromCodePoint(0xff5e)}12`);
  });

  it("寄せ先の全角チルダ U+FF5E は Shift_JIS でエンコードできる", () => {
    const encoded = iconv.encode(String.fromCodePoint(0xff5e), "Shift_JIS");
    expect(encoded.length === 1 && encoded[0] === 0x3f).toBe(false);
  });

  it("半角ハイフンや通常の文字はそのまま残す", () => {
    expect(normalizeForClickPostCsv("東京都渋谷区神宮前1-1-1")).toBe("東京都渋谷区神宮前1-1-1");
  });

  it("置換は1文字→1文字で、文字数を変えない", () => {
    const input = [0x2013, 0x2014, 0x301c, 0x2212].map((cp) => String.fromCodePoint(cp)).join("");
    expect(normalizeForClickPostCsv(input)).toHaveLength(input.length);
  });

  it("正規化後の文字列は Shift_JIS で「?」を生まない", () => {
    const raw = `神宮前1${String.fromCodePoint(0x2013)}2${String.fromCodePoint(
      0x2014
    )}301${String.fromCodePoint(0x301c)}305号`;
    const normalized = normalizeForClickPostCsv(raw);
    const roundTripped = iconv.decode(iconv.encode(normalized, "Shift_JIS"), "Shift_JIS");
    expect(roundTripped).toBe(normalized);
  });
});

describe("findUnmappableCp932Chars", () => {
  it("すべて CP932 で表現できる行では空配列を返す", () => {
    expect(findUnmappableCp932Chars(buildRow())).toEqual([]);
  });

  it("正規化しても表現できない文字(絵文字)を項目名つきで拾う", () => {
    const issues = findUnmappableCp932Chars(buildRow({ recipientName: "山田 太郎\u{1F600}" }));
    expect(issues).toEqual([
      {
        field: "recipientName",
        chars: [{ char: "\u{1F600}", codePoint: "U+1F600" }],
      },
    ]);
  });

  it("同じ文字が複数回出ても1回だけ報告する", () => {
    const issues = findUnmappableCp932Chars(buildRow({ addressLine1: "♡room♡" }));
    expect(issues).toHaveLength(1);
    expect(issues[0].chars).toEqual([{ char: "♡", codePoint: "U+2661" }]);
  });

  it("住所の各行を走査する", () => {
    const issues = findUnmappableCp932Chars(
      buildRow({ addressLine2: "♥", addressLine4: "♠" })
    );
    expect(issues.map((issue) => issue.field)).toEqual(["addressLine2", "addressLine4"]);
  });

  it("リテラルの「?」は問題として扱わない", () => {
    expect(findUnmappableCp932Chars(buildRow({ addressLine1: "??" }))).toEqual([]);
  });

  it("郵便番号・敬称・内容品は走査対象外", () => {
    const issues = findUnmappableCp932Chars(
      buildRow({ postalCode: "♥", honorific: "♥", contents: "♥" })
    );
    expect(issues).toEqual([]);
  });
});
