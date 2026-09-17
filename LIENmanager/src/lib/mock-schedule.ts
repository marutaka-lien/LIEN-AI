export type ScheduleEventKind = "公開予約" | "価格更新" | "説明文更新";
export type ScheduleConfirmState = "確認済み" | "確認待ち";

export type ScheduleDiff = {
  label: string;
  before: string;
  after: string;
};

export type ScheduleEvent = {
  key: string;
  day: number;
  time: string;
  kind: ScheduleEventKind;
  product: string;
  state: ScheduleConfirmState;
  summary: string;
  diffs: ScheduleDiff[];
};

/**
 * 見た目確認用のダミーデータ。年月・「今日」は 2026年9月18日 に固定している
 * （デザイン確認用のため、実際のカレンダーとは連動しない）。
 */
export const SCHEDULE_YEAR = 2026;
export const SCHEDULE_MONTH = 9;
export const SCHEDULE_TODAY = 18;

export const MOCK_SCHEDULE_EVENTS: ScheduleEvent[] = [
  {
    key: "3-0900",
    day: 3,
    time: "09:00",
    kind: "公開予約",
    product: "ハイネックインナー 2026AW",
    state: "確認済み",
    summary: "楽天へ新規登録し 9/20 から販売開始",
    diffs: [
      { label: "公開状態", before: "下書き", after: "公開（9/20 10:00）" },
      { label: "在庫", before: "未設定", after: "48点（S・M）" },
    ],
  },
  {
    key: "5-1130",
    day: 5,
    time: "11:30",
    kind: "説明文更新",
    product: "ギャザーブラウス",
    state: "確認待ち",
    summary: "スマートフォン用説明文を差し替え",
    diffs: [
      { label: "キャッチ", before: "夏の首元対策", after: "秋も、首元を隠して軽やかに。" },
      { label: "説明文", before: "全 142字", after: "全 186字" },
    ],
  },
  {
    key: "8-1000",
    day: 8,
    time: "10:00",
    kind: "公開予約",
    product: "ウールブレンドコート",
    state: "確認済み",
    summary: "秋冬の新作として公開",
    diffs: [
      { label: "公開状態", before: "下書き", after: "公開" },
      { label: "価格", before: "—", after: "¥32,800" },
    ],
  },
  {
    key: "10-1400",
    day: 10,
    time: "14:00",
    kind: "価格更新",
    product: "タックワイドパンツ",
    state: "確認待ち",
    summary: "秋の値上げ改定を反映",
    diffs: [
      { label: "販売価格", before: "¥9,600", after: "¥10,400" },
      { label: "二重価格", before: "¥10,800", after: "¥11,600" },
    ],
  },
  {
    key: "12-0930",
    day: 12,
    time: "09:30",
    kind: "説明文更新",
    product: "ハイウエストデニム",
    state: "確認済み",
    summary: "サイズガイドの記載を追記",
    diffs: [{ label: "説明文", before: "全 210字", after: "全 268字" }],
  },
  {
    key: "15-1000",
    day: 15,
    time: "10:00",
    kind: "公開予約",
    product: "キルティングジャケット",
    state: "確認待ち",
    summary: "10月の先行販売分を公開",
    diffs: [
      { label: "公開状態", before: "下書き", after: "公開" },
      { label: "在庫", before: "未設定", after: "58点" },
    ],
  },
  {
    key: "18-0900",
    day: 18,
    time: "09:00",
    kind: "価格更新",
    product: "ハイネックインナー 2026AW",
    state: "確認済み",
    summary: "販売価格とポイント変倍を変更",
    diffs: [
      { label: "販売価格", before: "¥2,980", after: "¥2,680" },
      { label: "ポイント", before: "設定しない", after: "5倍（9/18〜9/24）" },
    ],
  },
  {
    key: "18-1200",
    day: 18,
    time: "12:00",
    kind: "公開予約",
    product: "リブタンクトップ 3色",
    state: "確認待ち",
    summary: "楽天へ新規登録し 9/20 から販売開始",
    diffs: [
      { label: "公開状態", before: "下書き", after: "公開（9/20 10:00）" },
      { label: "色展開", before: "2色", after: "3色" },
    ],
  },
  {
    key: "18-1400",
    day: 18,
    time: "14:00",
    kind: "説明文更新",
    product: "ウエストリボンワンピース",
    state: "確認待ち",
    summary: "秋の着回し提案を追記",
    diffs: [
      { label: "キャッチ", before: "一枚で決まる軽やかさ", after: "重ね着でも決まる、秋のワンピース。" },
      { label: "説明文", before: "全 168字", after: "全 224字" },
    ],
  },
  {
    key: "18-1730",
    day: 18,
    time: "17:30",
    kind: "価格更新",
    product: "リネンワイドシャツ",
    state: "確認待ち",
    summary: "シーズン終盤の値下げ",
    diffs: [
      { label: "販売価格", before: "¥8,600", after: "¥6,900" },
      { label: "期間", before: "—", after: "9/18〜9/30" },
    ],
  },
  {
    key: "20-1600",
    day: 20,
    time: "16:00",
    kind: "説明文更新",
    product: "プリーツワンピース",
    state: "確認済み",
    summary: "素材表記を修正",
    diffs: [{ label: "素材", before: "ポリエステル", after: "ポリエステル100%" }],
  },
  {
    key: "24-1000",
    day: 24,
    time: "10:00",
    kind: "公開予約",
    product: "ロングカーディガン",
    state: "確認待ち",
    summary: "再入荷分を公開",
    diffs: [
      { label: "公開状態", before: "非公開", after: "公開" },
      { label: "在庫", before: "0点", after: "36点" },
    ],
  },
  {
    key: "26-1300",
    day: 26,
    time: "13:00",
    kind: "価格更新",
    product: "サテンロングスカート",
    state: "確認待ち",
    summary: "期間限定の割引を適用",
    diffs: [
      { label: "販売価格", before: "¥11,800", after: "¥9,800" },
      { label: "期間", before: "—", after: "9/26〜10/3" },
    ],
  },
];
