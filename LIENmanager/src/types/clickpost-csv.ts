// ClickPost「まとめ申込」用CSV(Shift_JIS)の、文字コード関連のクライアント/サーバー
// 共通型。iconv-lite等のサーバー依存を持たないこと(クライアントからもimportする)。

// CSV出力レスポンスに載せる、正規化してもCP932で表現できない文字が残った注文の一覧。
// 値はJSON文字列をencodeURIComponentしたもの(ヘッダーはlatin1しか載らないため)。
export const CLICKPOST_CSV_UNMAPPABLE_HEADER = "X-Unmappable-Report";

// 走査対象になるCSV項目(注文データ由来のもの)。郵便番号は数字のみに整形済み、
// 敬称・内容品は固定文言のため対象外。
export type ClickPostCsvField =
  | "recipientName"
  | "addressLine1"
  | "addressLine2"
  | "addressLine3"
  | "addressLine4";

export interface ClickPostCsvUnmappableChar {
  // 表示用の文字そのもの(画面はUTF-8なのでそのまま出せる)。
  char: string;
  // "U+XXXX" 形式のコードポイント。
  codePoint: string;
}

export interface ClickPostCsvUnmappableIssue {
  field: ClickPostCsvField;
  chars: ClickPostCsvUnmappableChar[];
}

export interface ClickPostCsvUnmappableOrder {
  orderNumber: string;
  issues: ClickPostCsvUnmappableIssue[];
}

export type ClickPostCsvUnmappableReport = ClickPostCsvUnmappableOrder[];

// 画面表示用の日本語ラベル。ヘッダーにはASCIIキー(field)だけを載せ、ラベル化は
// クライアント側で行う。
export const CLICKPOST_CSV_FIELD_LABELS: Record<ClickPostCsvField, string> = {
  recipientName: "お届け先氏名",
  addressLine1: "お届け先住所1行目",
  addressLine2: "お届け先住所2行目",
  addressLine3: "お届け先住所3行目",
  addressLine4: "お届け先住所4行目",
};
