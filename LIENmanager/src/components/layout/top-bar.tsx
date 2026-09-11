"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { useRunningJobCount } from "@/features/automation/hooks/useRunningJobCount";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "ダッシュボード",
  "/automation": "発送エントリー",
  "/reviews": "レビュー管理",
};

function resolvePageTitle(pathname: string): string {
  const match = Object.keys(PAGE_TITLES).find(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
  return match ? PAGE_TITLES[match] : "";
}

function useCurrentTime(): string {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return now.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

export function TopBar() {
  const pathname = usePathname();
  const title = resolvePageTitle(pathname);
  const runningJobCount = useRunningJobCount();
  const time = useCurrentTime();

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between border-b border-topbar-border bg-topbar px-4 backdrop-blur-xl sm:px-6">
      <div className="flex items-center gap-3">
        <div className="flex size-8 items-center justify-center rounded-lg border border-primary-border bg-primary-subtle text-primary md:hidden"><span className="text-xs font-bold">L</span></div>
        <div><p className="text-[0.62rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">Operations</p><h1 className="text-sm font-semibold tracking-tight">{title}</h1></div>
      </div>

      <div className="flex items-center gap-4">
        {runningJobCount > 0 && (
          <div
            className="flex items-center gap-2 rounded-full border border-primary-border bg-primary-subtle px-3 py-1"
            aria-label={`稼働中のジョブが${runningJobCount}件あります`}
          >
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
            </span>
            <span className="font-mono text-xs tabular-nums text-primary">
              稼働中 {runningJobCount}件
            </span>
          </div>
        )}

        <span
          className="font-mono text-xs tabular-nums text-muted-foreground"
          suppressHydrationWarning
        >
          <span className="hidden sm:inline">JST&nbsp;&nbsp;</span>{time}
        </span>
      </div>
    </header>
  );
}
