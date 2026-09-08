// クリックポストが書き出す「追跡番号入りCSV」(発送履歴/発送済み一覧のダウンロード)を読む。
//
// 2026-09-07 時点、このファイルの正確な列構成は実データで最終確認できていない。
// Gate 1 の調査では列は次の想定: 追跡番号 / お届け先郵便番号 / お届け先氏名 /
// お届け先敬称 / お届け先住所 / 内容品。列順が変わっても動くよう、位置ではなく
// ヘッダー名(部分一致)で必要な列を探す。想定外の場合は headerWarning を返し、
// 画面で人が気づけるようにする。

import iconv from "iconv-lite";

import { parseCsvText } from "@/server/shared/csv";
import type {
  ClickPostTrackingCsvParseResult,
  ClickPostTrackingRow,
} from "./rms-shipping-report-types";

// UTF-8 で解釈して「置換文字(U+FFFD)」が現れたら壊れているとみなし、Shift_JIS へフォールバック。
// クリックポストのCSVは Shift_JIS が濃厚だが、Excel等で開いて保存し直すと UTF-8(BOM付き)に
// なることがあるため両対応する。
export function decodeCsvBuffer(buffer: Buffer): string {
  // UTF-8 BOM。
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.subarray(3).toString("utf8");
  }
  const asUtf8 = buffer.toString("utf8");
  if (!asUtf8.includes("�")) {
    return asUtf8;
  }
  return iconv.decode(buffer, "Shift_JIS");
}

// ヘッダー行から、名前(部分一致)で列インデックスを引く。最初に一致した列を採る。
function findColumnIndex(header: string[], candidates: string[]): number {
  for (let i = 0; i < header.length; i++) {
    const cell = header[i]?.replace(/\s|　/g, "") ?? "";
    if (candidates.some((candidate) => cell.includes(candidate))) {
      return i;
    }
  }
  return -1;
}

const TRACKING_HEADER_CANDIDATES = ["追跡番号", "お問い合わせ番号", "問い合わせ番号", "問合せ番号"];
const POSTAL_HEADER_CANDIDATES = ["郵便番号"];
const NAME_HEADER_CANDIDATES = ["氏名", "宛名", "お名前", "名前"];
const ADDRESS_HEADER_CANDIDATES = ["住所"];

export function parseClickPostTrackingCsv(buffer: Buffer): ClickPostTrackingCsvParseResult {
  const text = decodeCsvBuffer(buffer);
  const table = parseCsvText(text);

  if (table.length === 0) {
    return { rows: [], droppedRowNumbers: [], headerWarning: "CSVが空です。" };
  }

  const header = table[0].map((cell) => cell.trim());
  const trackingIndex = findColumnIndex(header, TRACKING_HEADER_CANDIDATES);
  const postalIndex = findColumnIndex(header, POSTAL_HEADER_CANDIDATES);
  const nameIndex = findColumnIndex(header, NAME_HEADER_CANDIDATES);
  const addressIndex = findColumnIndex(header, ADDRESS_HEADER_CANDIDATES);

  const missing: string[] = [];
  if (trackingIndex === -1) missing.push("追跡番号");
  if (postalIndex === -1) missing.push("郵便番号");
  if (nameIndex === -1) missing.push("氏名");
  if (addressIndex === -1) missing.push("住所");

  if (trackingIndex === -1 || postalIndex === -1 || nameIndex === -1 || addressIndex === -1) {
    return {
      rows: [],
      droppedRowNumbers: [],
      headerWarning: `CSVのヘッダーに必要な列(${missing.join("・")})が見つかりませんでした。クリックポストからダウンロードしたCSVか確認してください。実際のヘッダー: ${JSON.stringify(header)}`,
    };
  }

  const rows: ClickPostTrackingRow[] = [];
  const droppedRowNumbers: number[] = [];

  for (let i = 1; i < table.length; i++) {
    const columns = table[i];
    const sourceRowNumber = i; // データ行の1始まり。
    const trackingNumber = (columns[trackingIndex] ?? "").trim();
    const postalCode = (columns[postalIndex] ?? "").trim();
    const recipientName = (columns[nameIndex] ?? "").trim();
    const address = (columns[addressIndex] ?? "").trim();

    // 追跡番号か宛先3点のいずれかが空なら突き合わせできないため落とす。
    if (!trackingNumber || !postalCode || !recipientName || !address) {
      droppedRowNumbers.push(sourceRowNumber);
      continue;
    }

    rows.push({ trackingNumber, postalCode, recipientName, address, sourceRowNumber });
  }

  return { rows, droppedRowNumbers };
}
