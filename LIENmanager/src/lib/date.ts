const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

// 日本時間で「今日」の0:00〜翌0:00(排他的)をUTC基準のDateとして返す。
// サーバーのOS時刻帯に依存せず常にJST基準で日付境界を判定するために使う。
export function getJstDayRange(now: Date = new Date()): { start: Date; end: Date } {
  const jstNow = new Date(now.getTime() + JST_OFFSET_MS);
  const year = jstNow.getUTCFullYear();
  const month = jstNow.getUTCMonth();
  const day = jstNow.getUTCDate();

  const start = new Date(Date.UTC(year, month, day, 0, 0, 0) - JST_OFFSET_MS);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  return { start, end };
}

// 「直近N日」の開始時刻(N日前の同時刻)を返す。発送エントリー画面の作業中/処理済み
// セグメント(直近7日で絞る)向け。JST日付境界ではなく単純な経過時間で判定する
// (「7日前の同時刻から現在まで」であり、日付が変わった瞬間に一覧から消えるわけではない)。
export function getRecentDaysStart(days: number, now: Date = new Date()): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

// 日本時間で "M/D HH:mm" に整形する。発送エントリー「作業メニュー」の一覧行(受注時刻・
// CSV出力・報告日時・退避日時)向け。今日とは限らない日付を扱うため月日まで出す
// (時刻だけのformatJstHmとは用途が違う)。
export function formatJstDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  });
}

// 日本時間で "YYYYMMDD_HHMMSS" 形式に整形する。1日に複数回作成され得る
// ファイル名の一意性・可読性を確保するために使う(ClickPost CSV出力等)。
export function formatJstTimestampCompact(now: Date = new Date()): string {
  const jstNow = new Date(now.getTime() + JST_OFFSET_MS);
  const pad = (value: number) => String(value).padStart(2, "0");

  const year = jstNow.getUTCFullYear();
  const month = pad(jstNow.getUTCMonth() + 1);
  const day = pad(jstNow.getUTCDate());
  const hours = pad(jstNow.getUTCHours());
  const minutes = pad(jstNow.getUTCMinutes());
  const seconds = pad(jstNow.getUTCSeconds());

  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}
