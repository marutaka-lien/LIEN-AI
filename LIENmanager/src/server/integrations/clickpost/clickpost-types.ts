// クリックポスト連携専用の型・定数。
//
// 2026-07-22 調査結果:
// - クリックポストに公式APIは公開されていない(複数の一次情報源で確認)。
// - 正式な連携方法は「マイページ」にログインし「まとめ申込」からCSVを
//   アップロードする方式(CSVはShift_JISのみ受付)。
// - 1回のアップロード上限は40件。
// - 住所は最大4行、各行全角20文字以内。
// - 追跡番号はラベルのバーコード下に印字される62から始まる12桁の数字で、
//   登録・決済完了後に発行され、マイページの発送履歴からも確認できる。
//
// CSV列構成はプロジェクトに実在した実データ(clickpost_20260709_091456.csv、
// 2026-07-09時点でユーザーのClickPostアカウントから出力されたと思われるファイル)の
// ヘッダー行から確認した(値=個人情報は一切参照していない)。
//
// 2026-07-23 公式CSV作成マニュアル(https://clickpost.jp/create_csv_manual_yahoo.pdf、
// 「まとめ申込」画面からリンクされている公式ヘルプ資料)で各列の文字数上限を確認した:
// - お届け先氏名(B列): 全角20文字または半角40文字以内
// - お届け先住所1〜4行目(D〜G列): それぞれ全角20文字または半角40文字以内
// - 内容品(H列): 全角15文字または半角30文字以内 ← 住所欄とは上限が異なる
// 全角/半角の厳密な幅計算は未実装のため、既存の住所欄分割ロジックと同様、
// 文字数ベースの近似(1文字=1としてカウント)で上限を適用している。

export const CLICKPOST_MAX_ITEMS_PER_BATCH = 40;
export const CLICKPOST_ADDRESS_LINE_MAX_LENGTH = 20;
export const CLICKPOST_ADDRESS_LINE_COUNT = 4;
// 公式マニュアル確認済みの上限(全角15文字/半角30文字)。参考値として保持。
// 2026-07-27時点、業務都合により内容品は商品名を個別記載せず固定文言(CLICKPOST_DEFAULT_CONTENTS)
// とする運用に変更したため、この上限に対する切り詰め処理はmapper側では行っていない。
export const CLICKPOST_CONTENTS_MAX_LENGTH = 15;
export const CLICKPOST_DEFAULT_HONORIFIC = "様";
// 内容品欄は商品名の個別解析(rawPayloadパース)をやめ、常にこの固定文言を使う。
export const CLICKPOST_DEFAULT_CONTENTS = "衣料品";

export const CLICKPOST_CSV_HEADER = [
  "お届け先郵便番号",
  "お届け先氏名",
  "お届け先敬称",
  "お届け先住所1行目",
  "お届け先住所2行目",
  "お届け先住所3行目",
  "お届け先住所4行目",
  "内容品",
] as const;

export interface ClickPostCsvRow {
  postalCode: string;
  recipientName: string;
  honorific: string;
  addressLine1: string;
  addressLine2: string;
  addressLine3: string;
  addressLine4: string;
  contents: string;
}
