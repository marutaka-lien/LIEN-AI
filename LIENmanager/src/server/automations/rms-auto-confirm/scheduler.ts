import { runAutoConfirmSweep } from "./auto-confirm-sweep";

const DEFAULT_INTERVAL_MS = 120_000; // 2分。RMSにWebhookが無いための近似ポーリング間隔。

function getIntervalMs(): number {
  const raw = process.env.RMS_AUTO_CONFIRM_INTERVAL_MS;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_INTERVAL_MS;
}

// Next.jsの開発モードHMRで多重登録しないよう、prisma/browser-contextと同じ
// globalThisシングルトンパターンでガードする。
const globalForAutoConfirm = globalThis as unknown as {
  rmsAutoConfirmTimer?: ReturnType<typeof setInterval>;
};

export function startAutoConfirmScheduler(): void {
  if (process.env.RMS_AUTO_CONFIRM_ENABLED === "false") {
    console.log("[rms-auto-confirm] RMS_AUTO_CONFIRM_ENABLED=falseのため起動しません");
    return;
  }

  if (globalForAutoConfirm.rmsAutoConfirmTimer) return;

  const intervalMs = getIntervalMs();
  console.log(`[rms-auto-confirm] 自動注文確認スケジューラを起動しました(${intervalMs}ms間隔)`);

  const timer = setInterval(() => {
    runAutoConfirmSweep()
      .then((result) => {
        if (result.skipped) {
          console.log("[rms-auto-confirm] 前回のスイープが実行中のため今回はスキップしました");
          return;
        }
        if (result.checked > 0) {
          console.log(
            `[rms-auto-confirm] 確認対象${result.checked}件 / 成功${result.confirmed}件 / 失敗${result.failed}件` +
              (result.jobId ? ` / jobId=${result.jobId}` : "")
          );
          if (result.failureReasons.length > 0) {
            console.log("[rms-auto-confirm] 失敗理由:", result.failureReasons.join(" / "));
          }
        }
      })
      .catch((error: unknown) => {
        console.error(
          "[rms-auto-confirm] スイープ中にエラーが発生しました:",
          error instanceof Error ? error.message : "unknown error"
        );
      });
  }, intervalMs);

  // このタイマーの存在だけでNode.jsプロセスの終了を妨げないようにする。
  timer.unref?.();
  globalForAutoConfirm.rmsAutoConfirmTimer = timer;
}
