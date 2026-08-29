import iconv from "iconv-lite";

import type {
  ClickPostCsvField,
  ClickPostCsvUnmappableIssue,
} from "@/types/clickpost-csv";
import type { ClickPostCsvRow } from "./clickpost-types";

// クリックポストのCSVはShift_JIS(CP932)のみ受付。iconv-liteはCP932に無い文字を
// 単一バイト0x3F("?")へ黙って置換するため、事前に安全な文字へ寄せておく。

// CP932へ変換すると"?"化する、またはグリフが変わってしまうダッシュ・ハイフン・
// マイナス類。すべて半角ハイフン"-"へ統一する。見分けの付きにくい文字を含むため、
// あえて \u エスケープで列挙する。
// - U+2011/U+2012/U+2013/U+2014/U+2212/U+00AD: CP932に無く"?"になる。
// - U+2010 HYPHEN / U+2015 HORIZONTAL BAR: "?"にはならないがCP932の別区点へ写り、
//   受け手側で別グリフ(U+2016「‖」の位置など)に見えるため統一する。
const DASH_LIKE_TO_HYPHEN =
  /[­‐‑‒–—―−]/g;

// 波ダッシュ U+301C は"-"にすると範囲表記(例: 10〜12)の意味が変わるため、CP932で
// 安全な全角チルダ U+FF5E へ寄せる(万一変換不可なら"-"へフォールバック)。
const WAVE_DASH = /〜/g;
const FULLWIDTH_TILDE = "～";
const WAVE_DASH_TARGET = canEncodeCp932(FULLWIDTH_TILDE) ? FULLWIDTH_TILDE : "-";

// iconv-liteの置換バイト。0x3FはShift_JISのトレイルバイトになり得ず、単独の0x3Fは
// 元の文字が"?"のときにしか現れないため、これで置換発生を判定できる。
function isReplacedToQuestionMark(char: string): boolean {
  if (char === "?") return false;
  const encoded = iconv.encode(char, "Shift_JIS");
  return encoded.length === 1 && encoded[0] === 0x3f;
}

function canEncodeCp932(char: string): boolean {
  return !isReplacedToQuestionMark(char);
}

function toCodePoint(char: string): string {
  return `U+${(char.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, "0")}`;
}

// お届け先氏名・住所などの文字列を、CP932で安全な表記へ正規化する。
// 置換はいずれも1文字→1文字なので、呼び出し側の文字数上限判定に影響しない。
export function normalizeForClickPostCsv(value: string): string {
  return value.replace(DASH_LIKE_TO_HYPHEN, "-").replace(WAVE_DASH, WAVE_DASH_TARGET);
}

// 正規化後もなおCP932で表現できない文字(絵文字・ごく稀な漢字など)を、CSV行の
// 各項目から拾う。除外はしない=呼び出し側でCSVには含めたうえで画面通知に使う。
const SCANNED_FIELDS: readonly ClickPostCsvField[] = [
  "recipientName",
  "addressLine1",
  "addressLine2",
  "addressLine3",
  "addressLine4",
];

export function findUnmappableCp932Chars(row: ClickPostCsvRow): ClickPostCsvUnmappableIssue[] {
  const issues: ClickPostCsvUnmappableIssue[] = [];

  for (const field of SCANNED_FIELDS) {
    const value = row[field];
    if (!value) continue;

    // 同じ文字が複数回出ても1回だけ報告する。
    const seen = new Map<string, string>();
    for (const char of Array.from(value)) {
      if (isReplacedToQuestionMark(char) && !seen.has(char)) {
        seen.set(char, toCodePoint(char));
      }
    }

    if (seen.size > 0) {
      issues.push({
        field,
        chars: Array.from(seen, ([char, codePoint]) => ({ char, codePoint })),
      });
    }
  }

  return issues;
}
