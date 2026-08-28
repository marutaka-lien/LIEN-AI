import {
  automationJobRepository,
  type createAutomationJobRepository,
} from "@/server/automation/automation-job.repository";
import { RMS_ORDER_PROGRESS } from "@/server/integrations/rms/rms-types";
import { createDefaultRmsService, type RmsService } from "@/server/integrations/rms/rms-service";
import { CARRIER_NONE, RMS_AUTO_CONFIRM_MODULE_KEY, STEP_KEY } from "./automation-module";

// 「注文が入ったら即座に注文確認を行う」ための独立した前処理。
// 通常の楽天RMS + クリックポスト自動化(Orchestrator、moduleKey="rakuten_clickpost")とは
// 別に、RMSの注文確認(orderProgress=100 → 実際に「注文確認」ボタンをクリック)だけを
// 定期的に行う。ClickPostへの登録・決済には一切関与しない。
//
// 「即座に」とはいえRMSにWebhook等は存在しないため、真の意味での即時反応はできない。
// 定期的な軽いポーリング(スケジューラ側でinterval管理)による近似である点に注意。

export interface AutoConfirmSweepResult {
  checked: number;
  confirmed: number;
  failed: number;
  // 失敗理由(注文番号やお届け先情報は含まない、汎用のエラーメッセージのみ)。
  // 診断用。同一理由が複数件あっても重複除去はせずそのまま入れる(件数把握のため)。
  failureReasons: string[];
  // 前回のスイープが実行中で、今回は何もせずスキップした場合true
  // (同じ注文を二重にクリックしないための排他制御)。
  skipped: boolean;
  // 実際に処理を行った場合のみAutomationJobのIDを返す(0件だった場合はJob自体を作らない)。
  jobId?: string;
}

type JobRepository = ReturnType<typeof createAutomationJobRepository>;

// スケジューラのtickと手動トリガーAPI(/api/rms/auto-confirm/run)が同時に走った場合、
// 同一の注文をPlaywrightで二重にクリックしてしまう恐れがある(同じ永続化ブラウザページを
// 共有しているため)。globalThisで単純な排他フラグを持ち、二重実行を防ぐ
// (prisma/browser-contextと同じNext.js HMR対策パターン)。
const globalForSweepLock = globalThis as unknown as { rmsAutoConfirmRunning?: boolean };

export async function runAutoConfirmSweep(
  rmsService: RmsService = createDefaultRmsService(),
  jobRepository: JobRepository = automationJobRepository,
  now: () => Date = () => new Date()
): Promise<AutoConfirmSweepResult> {
  if (globalForSweepLock.rmsAutoConfirmRunning) {
    return { checked: 0, confirmed: 0, failed: 0, failureReasons: [], skipped: true };
  }

  globalForSweepLock.rmsAutoConfirmRunning = true;

  try {
    const fetchResult = await rmsService.fetchPendingOrders({
      orderProgressList: [RMS_ORDER_PROGRESS.AWAITING_CONFIRM],
    });

    const pendingOrders = fetchResult.orders.filter(
      (order) => Number(order.orderStatus) === RMS_ORDER_PROGRESS.AWAITING_CONFIRM
    );

    if (pendingOrders.length === 0) {
      return { checked: 0, confirmed: 0, failed: 0, failureReasons: [], skipped: false };
    }

    const job = await jobRepository.createJob({
      moduleKey: RMS_AUTO_CONFIRM_MODULE_KEY,
      status: "running",
      totalCount: pendingOrders.length,
      startedAt: now(),
    });

    let confirmed = 0;
    let failed = 0;
    const failureReasons: string[] = [];

    for (const order of pendingOrders) {
      const item = await jobRepository.createItem({
        jobId: job.id,
        orderId: order.id,
        carrier: CARRIER_NONE,
        status: "running",
      });

      const step = await jobRepository.createStep({
        jobId: job.id,
        jobItemId: item.id,
        stepKey: STEP_KEY.RMS_ORDER_CONFIRM,
        status: "running",
        startedAt: now(),
      });

      try {
        const result = await rmsService.confirmOrder(
          order.orderNumber,
          RMS_ORDER_PROGRESS.AWAITING_CONFIRM,
          { execute: true }
        );

        if (result.success) {
          confirmed += 1;
          await jobRepository.updateStep(step.id, { status: "success", finishedAt: now() });
          await jobRepository.updateItem(item.id, { status: "success", processedAt: now() });
        } else {
          failed += 1;
          const message = result.message ?? "(理由不明)";
          failureReasons.push(message);
          await jobRepository.updateStep(step.id, {
            status: "failed",
            finishedAt: now(),
            errorMessage: message,
          });
          await jobRepository.updateItem(item.id, {
            status: "failed",
            processedAt: now(),
            errorMessage: message,
          });
        }
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : "unknown error";
        failureReasons.push(message);
        await jobRepository.updateStep(step.id, {
          status: "failed",
          finishedAt: now(),
          errorMessage: message,
        });
        await jobRepository.updateItem(item.id, {
          status: "failed",
          processedAt: now(),
          errorMessage: message,
        });
      }

      await jobRepository.updateJob(job.id, {
        successCount: confirmed,
        failureCount: failed,
        progressPercentage: Math.round(((confirmed + failed) / pendingOrders.length) * 100),
      });
    }

    await jobRepository.updateJob(job.id, {
      status: failed > 0 ? "failed" : "success",
      currentLabel: null,
      finishedAt: now(),
    });

    return {
      checked: pendingOrders.length,
      confirmed,
      failed,
      failureReasons,
      skipped: false,
      jobId: job.id,
    };
  } finally {
    globalForSweepLock.rmsAutoConfirmRunning = false;
  }
}
