"use client";

import { useEffect, useState } from "react";

// 汎用ポーリングフック。UIコンポーネントからsetInterval/fetch/停止判定を切り離すためのもの。
// automation-card.tsx / job-history.tsx はこのフックの戻り値(data/error)だけを見ればよく、
// 将来SSE/WebSocketに置き換える場合もこのファイルの内部実装を差し替えるだけで済む。
//
// 注意: fetcher/isSettled/onErrorは呼び出し側でモジュールスコープの関数か
// useCallbackで安定した参照にしておくこと。毎レンダー新しい関数を渡すと、
// そのたびにポーリングが再起動してしまう。

export interface UsePollingOptions<T> {
  // falseの間は一切fetchしない(例: jobId未確定の間)。
  enabled: boolean;
  fetcher: () => Promise<T>;
  // trueを返した時点でポーリングを停止する(例: JobStatusがsuccess/failed/stopped)。
  isSettled: (data: T) => boolean;
  intervalMs?: number;
  onError?: (error: unknown) => void;
}

export interface UsePollingResult<T> {
  data: T | null;
  error: unknown;
  isPolling: boolean;
}

export const DEFAULT_POLLING_INTERVAL_MS = Number(
  process.env.NEXT_PUBLIC_AUTOMATION_POLL_INTERVAL_MS ?? 2000
);

export function usePolling<T>({
  enabled,
  fetcher,
  isSettled,
  intervalMs = DEFAULT_POLLING_INTERVAL_MS,
  onError,
}: UsePollingOptions<T>): UsePollingResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function tick() {
      try {
        const result = await fetcher();
        if (cancelled) return;
        setData(result);
        setError(null);
        if (!isSettled(result)) {
          timer = setTimeout(tick, intervalMs);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err);
        onError?.(err);
        timer = setTimeout(tick, intervalMs);
      }
    }

    tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [enabled, fetcher, isSettled, intervalMs, onError]);

  // isPollingはstateとして持たず、既知の最新dataから導出する
  // (「効果内で同期的にsetStateする」ことを避けるため)。
  const isPolling = enabled && (data === null || !isSettled(data));

  return { data, error, isPolling };
}
