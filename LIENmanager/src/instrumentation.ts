// Next.jsのInstrumentation機構(register()はサーバー起動時に1回だけ呼ばれる)を使い、
// 「注文が入ったら自動でRMS注文確認を行う」バックグラウンドスケジューラを起動する。
// 通常のOrchestrator(手動実行/rakuten_clickpost)とは独立した機能。

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startAutoConfirmScheduler } = await import(
      "@/server/automations/rms-auto-confirm/scheduler"
    );
    startAutoConfirmScheduler();
  }
}
