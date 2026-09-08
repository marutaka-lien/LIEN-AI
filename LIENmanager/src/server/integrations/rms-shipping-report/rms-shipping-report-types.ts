// RMS「発送完了報告データ(アップロード用)」への変換に使う、サーバー内部の型・定数。
// 画面ともやり取りする結果型は `@/types/shipping-report` にある。
//
// 出典: 楽天 店舗運営Navi 000038913「発送完了報告データ(アップロード用)のデータ形式」。
// クリックポストが発行する追跡番号(お問い合わせ番号)を、RMSの「お荷物伝票番号」欄へ
// 一括反映するためのアップロード用CSVを、LIENmanager 側で自前生成する。
// 設計の詳細・経緯は `Gram/Gate1_発送番号のRMS反映_2026-09-07.md`(CEOリポジトリ)を参照。

export type {
  ShippingReportClassification,
  ShippingReportCsvRowDTO,
} from "@/types/shipping-report";

// アップロード用CSVのヘッダー(1行目・順序固定・改変不可)。
export const RMS_SHIPPING_REPORT_CSV_HEADER = [
  "注文番号",
  "送付先ID",
  "発送明細ID",
  "お荷物伝票番号",
  "配送会社",
  "発送日",
] as const;

// 配送会社コード。今回の運用は日本郵便(クリックポスト)固定。
// RMS店舗設定に日本郵便が登録済みであることをマスターが確認済み(2026-09-07)。
// 参考: 1000=その他 / 1001=ヤマト運輸 / 1002=佐川急便 / 1003=日本郵便 /
//       1029=日本郵便 楽天倉庫出荷 / 1030=ヤマト運輸 クロネコゆうパケット ほか
export const DELIVERY_COMPANY_JAPAN_POST = "1003";

// RMSアップロード画面の制約。
export const MAX_ROWS_PER_UPLOAD = 5000;
// 注文日(注文番号先頭の yyyymmdd)から数えて何日以内の注文までアップロード可能か。
export const MAX_ORDER_AGE_DAYS = 180;

// お荷物伝票番号の文字数上限(RMS仕様)。クリックポストの追跡番号は62始まりの12桁数字
// なので通常は問題にならないが、想定外の値が来た場合に弾く。
export const TRACKING_NUMBER_MAX_LENGTH = 120;

// クリックポストが書き出す「追跡番号入りCSV」の1行分。
// 列見出しはヘッダー名で検出するため、ここでは意味のある値だけを保持する。
export interface ClickPostTrackingRow {
  // 追跡番号(お問い合わせ番号)。
  trackingNumber: string;
  postalCode: string;
  recipientName: string;
  address: string;
  // 突き合わせ・要確認表示のための行番号(データ行の1始まり)。
  sourceRowNumber: number;
}

// クリックポスト追跡番号CSVのパース結果。
export interface ClickPostTrackingCsvParseResult {
  rows: ClickPostTrackingRow[];
  // ヘッダーの検出で想定と違う点があれば、画面で知らせるための警告文(無ければ undefined)。
  headerWarning?: string;
  // 追跡番号・宛先のいずれかが空で、突き合わせに使えなかった行の番号。
  droppedRowNumbers: number[];
}

// 変換対象となる注文(DB上の Order からこの変換に必要な項目だけを抜き出したもの)。
export interface ShippingReportTargetOrder {
  id: string;
  orderNumber: string;
  recipientName: string | null;
  ordererName: string;
  postalCode: string | null;
  prefecture: string | null;
  address1: string | null;
  address2: string | null;
  orderedAt: Date | null;
  // RMS getOrder のレスポンス生データ(JSON文字列)。複数送付先の検出にのみ読み取りで使う。
  rawPayload: string | null;
}

// アップロード用CSVに実際に書き出す1行(サーバー内部。DTO は @/types/shipping-report)。
export interface ShippingReportCsvRow {
  orderNumber: string;
  // 送付先ID・発送明細IDは常に空欄(= RMS仕様上「送付先1へ新規登録」)。
  shippingTrackingNumber: string;
  deliveryCompany: string;
  // yyyy-mm-dd。
  shippingDate: string;
}
