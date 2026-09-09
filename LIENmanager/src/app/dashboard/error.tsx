"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";

// /dashboard のエラー境界。原因＋次の操作（再試行）を出す。
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard] 画面の読み込みに失敗しました:", error);
  }, [error]);

  return (
    <div className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex max-w-xl items-start gap-3 rounded-xl border border-error-border bg-error-subtle p-5">
        <TriangleAlert className="mt-0.5 size-5 shrink-0 text-error-foreground" aria-hidden />
        <div>
          <p className="text-sm font-semibold">画面を読み込めませんでした</p>
          <p className="mt-1 text-sm text-text-secondary">
            データの取得中に問題が発生しました。少し待ってから再試行してください。続く場合は
            RMS との同期状況（発送エントリー画面）を確認してください。
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover"
          >
            <RotateCcw className="size-4" aria-hidden />
            再試行する
          </button>
        </div>
      </div>
    </div>
  );
}
