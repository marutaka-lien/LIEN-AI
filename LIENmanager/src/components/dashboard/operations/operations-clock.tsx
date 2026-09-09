"use client";

import { useEffect, useState } from "react";

// ヘッダー右側の「時刻 / 日付 / 稼働中」。30秒ごとに更新する。
// 稼働中ドットの点滅は globals.css の prefers-reduced-motion で自動的に止まる。
// サーバー時刻とクライアント時刻の差は分表示なら無視できるため suppressHydrationWarning を付ける。

function jstParts(now: Date): { time: string; date: string } {
  const time = new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Tokyo",
  }).format(now);
  const date = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    timeZone: "Asia/Tokyo",
  }).format(now);
  return { time, date };
}

export function OperationsClock() {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const { time, date } = jstParts(now);

  return (
    <div className="flex items-center gap-4 font-mono text-xs tabular-nums text-text-secondary">
      <span className="text-sm text-foreground" suppressHydrationWarning>
        {time}
      </span>
      <span suppressHydrationWarning>{date}</span>
      <span className="flex items-center gap-1.5">
        <span className="size-1.5 animate-pulse rounded-full bg-success-foreground" aria-hidden />
        <span className="font-sans">稼働中</span>
      </span>
    </div>
  );
}
