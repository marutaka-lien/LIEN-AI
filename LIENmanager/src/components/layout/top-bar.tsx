"use client";

import { useEffect, useState } from "react";

import { useRunningJobCount } from "@/features/automation/hooks/useRunningJobCount";

// ページ名はナビの選択状態で分かるため、ここには出さない（2026-10-24 見出しの整理）。
// 右上に「稼働中のジョブ」と「現在時刻・日付」だけを置く。

function useJstNow(): { time: string; date: string } {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(timer);
  }, []);

  return {
    time: new Intl.DateTimeFormat("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Tokyo",
    }).format(now),
    date: new Intl.DateTimeFormat("ja-JP", {
      month: "numeric",
      day: "numeric",
      weekday: "short",
      timeZone: "Asia/Tokyo",
    }).format(now),
  };
}

export function TopBar() {
  const runningJobCount = useRunningJobCount();
  const { time, date } = useJstNow();

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between px-4 sm:px-6 lg:px-8">
      <div className="flex size-9 items-center justify-center rounded-xl bg-[linear-gradient(150deg,oklch(0.64_0.12_24),oklch(0.5_0.11_18))] text-white md:hidden">
        <span className="text-xs font-bold">L</span>
      </div>

      <div className="glass ml-auto flex h-10 items-center gap-3 rounded-full px-4">
        {runningJobCount > 0 && (
          <span
            className="flex items-center gap-2 border-r border-border-subtle pr-3"
            aria-label={`稼働中のジョブが${runningJobCount}件あります`}
          >
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
            </span>
            <span className="text-xs font-medium tabular-nums text-primary">稼働中 {runningJobCount}件</span>
          </span>
        )}
        <span className="text-xs tabular-nums text-text-secondary" suppressHydrationWarning>
          {date}
        </span>
        <span className="text-sm font-semibold tabular-nums" suppressHydrationWarning>
          {time}
        </span>
      </div>
    </header>
  );
}
