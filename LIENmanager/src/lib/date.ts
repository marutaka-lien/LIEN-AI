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
