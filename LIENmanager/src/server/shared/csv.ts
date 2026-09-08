// プロジェクト共通の手組みCSVユーティリティ。
// CSVパースライブラリの依存を増やさない方針(clickpost-csv.ts / rms-review-csv.ts も
// 手組み)のため、引用符・カンマ・(引用符内の)改行に対応した最小限の実装をここへ集約する。

// 引用符・カンマ・(引用符内の)改行を考慮した簡易CSVパーサー。
// 住所や本文にカンマ・改行が含まれ得るため、単純な行分割では壊れる。
export function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\r") {
      // \r\n の \r はここでは無視し、\n で行を確定する。
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  // 末尾に改行がない場合の最終フィールド・行を回収する。
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // 空行(カンマもデータも無い行)は捨てる。
  return rows.filter((columns) => !(columns.length === 1 && columns[0] === ""));
}

// CSV1フィールドを RFC4180 準拠でクォートする。カンマ・引用符・改行を含む場合のみ
// ダブルクォートで囲み、内部の " は "" にエスケープする。
export function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// 行(文字列配列)の配列を CRLF 区切りの CSV テキストへ組み立てる。
export function buildCsvText(rows: readonly (readonly string[])[]): string {
  return rows.map((columns) => columns.map(escapeCsvField).join(",")).join("\r\n");
}
