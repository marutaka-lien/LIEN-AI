import { automationJobRepository } from "@/server/automation/automation-job.repository";
import { createDefaultClickPostService } from "@/server/integrations/clickpost/clickpost-service";
import { isOrderConfirmationRequired } from "@/server/integrations/rms/rms-order-status";
import { createDefaultRmsService } from "@/server/integrations/rms/rms-service";
import { toOrderDTO } from "@/server/order/order.mapper";
import { orderRepository } from "@/server/order/order.repository";
import type { Order } from "@/generated/prisma/client";
import type { createAutomationJobRepository } from "@/server/automation/automation-job.repository";
import type { ClickPostService } from "@/server/integrations/clickpost/clickpost-service";
import type { RmsService } from "@/server/integrations/rms/rms-service";
import type { OrderDTO } from "@/types/order";

import { CARRIER, RAKUTEN_CLICKPOST_MODULE_KEY, STEP_KEY } from "./automation-module";
import type { RunRakutenClickPostOptions } from "./types";

// 「RMS API → Order保存 → orderProgress判定 → (必要時)RMS注文確認 → ClickPost登録 →
// AutomationJobItem/AutomationStep更新」という全体の処理順序を管理する。
//
// 責務分離: このOrchestratorはRmsService/ClickPostServiceのメソッドを呼び出すだけで、
// RmsBrowserClient/ClickPostBrowserClient/Playwright/RMSやClickPostの画面構造を一切知らない。

type JobRepository = ReturnType<typeof createAutomationJobRepository>;

// Prismaの生成する findById() の戻り値はチェーン可能な特殊な型(Prisma__OrderClient)のため、
// テスト用モックが実装しやすいよう、ポート自体はプレーンなPromiseの形で明示的に定義する。
export interface OrderRepositoryPort {
  findById(id: string): Promise<Order | null>;

  // 2026-08-25経営判断: 対象注文の判定を「今日の受注か」という日付フィルタに依存させず、
  // 状態(orderStatus=300 かつ ClickPost未登録)のみで決める。受注日をまたいで処理が
  // 止まっても、翌日以降に積み残される心配がない(orderNumbers未指定=全件実行時のみ使う。
  // 選択実行(orderNumbers指定あり)の場合はこの判定を経由しない=既存の選択機能がそのまま
  // 「対象から外す」役割を果たす)。
  findClickPostTargetOrders(): Promise<Order[]>;

  // ClickPost登録(まとめ申込〜支払手続き画面到達)成功時に呼び、以後の対象判定から除外する。
  markClickPostRegistered(id: string, registeredAt: Date): Promise<Order>;
}

export interface RmsClickPostOrchestratorDeps {
  jobRepository: JobRepository;
  orderRepository: OrderRepositoryPort;
  rmsService: RmsService;
  clickPostService: ClickPostService;
  now?: () => Date;
}

export interface RmsClickPostOrchestrator {
  // AutomationJobを作成し、処理をバックグラウンドで開始する。作成したjobIdを即座に返す
  // (HTTPリクエストをブロックしない。進捗はjobIdを使ってポーリングで確認する)。
  run(options?: RunRakutenClickPostOptions): Promise<string>;

  // 既存のJobIdに対して処理を最後まで実行し、完了を待つ。テスト・スクリプト用に公開している
  // (runはfire-and-forgetのため完了を待てない)。
  executeJob(jobId: string, options?: RunRakutenClickPostOptions): Promise<void>;
}

export function createRmsClickPostOrchestrator(
  deps: RmsClickPostOrchestratorDeps
): RmsClickPostOrchestrator {
  const { jobRepository, orderRepository, rmsService, clickPostService, now = () => new Date() } =
    deps;

  async function run(options: RunRakutenClickPostOptions = {}): Promise<string> {
    const job = await jobRepository.createJob({
      moduleKey: RAKUTEN_CLICKPOST_MODULE_KEY,
      status: "running",
      startedAt: now(),
    });

    // 実行はバックグラウンドで進める。ここでawaitしないことで呼び出し側(Route Handler)は
    // 即座にjobIdを返せる。想定外の例外はここでJobをfailedにして握りつぶす
    // (executeJob内の個別try/catchで処理しきれなかった致命的なエラーのみここに来る)。
    executeJob(job.id, options).catch(async (error) => {
      await jobRepository.updateJob(job.id, {
        status: "failed",
        finishedAt: now(),
        currentLabel: error instanceof Error ? error.message : "unknown error",
      });
    });

    return job.id;
  }

  async function executeJob(
    jobId: string,
    options: RunRakutenClickPostOptions = {}
  ): Promise<void> {
    const fetchStep = await jobRepository.createStep({
      jobId,
      stepKey: STEP_KEY.RMS_FETCH,
      status: "running",
      startedAt: now(),
    });

    let orders: OrderDTO[];
    try {
      // RMSとの同期(DBへのupsert)が目的。返り値自体は「選択実行」の絞り込みにのみ使う
      // (全件実行時の対象判定はfetchPendingOrdersの結果ではなく、状態ベースの
      // findClickPostTargetOrdersに委ねる。RMS検索の日付窓(RMS_SEARCH_LOOKBACK_DAYS)に
      // 処理対象の判定が引きずられないようにするため)。
      const fetchResult = await rmsService.fetchPendingOrders();
      orders =
        options.orderNumbers && options.orderNumbers.length > 0
          ? fetchResult.orders.filter((order) => options.orderNumbers?.includes(order.orderNumber))
          : (await orderRepository.findClickPostTargetOrders()).map(toOrderDTO);
      await jobRepository.updateStep(fetchStep.id, { status: "success", finishedAt: now() });
    } catch (error) {
      await jobRepository.updateStep(fetchStep.id, {
        status: "failed",
        finishedAt: now(),
        errorMessage: error instanceof Error ? error.message : "unknown error",
      });
      await jobRepository.updateJob(jobId, {
        status: "failed",
        finishedAt: now(),
        currentLabel: "RMSからの注文取得に失敗しました",
      });
      return;
    }

    await jobRepository.updateJob(jobId, { totalCount: orders.length });

    if (orders.length === 0) {
      await jobRepository.updateJob(jobId, {
        status: "success",
        progressPercentage: 100,
        currentLabel: null,
        finishedAt: now(),
      });
      return;
    }

    let successCount = 0;
    let failureCount = 0;

    for (const [index, order] of orders.entries()) {
      if (await jobRepository.isStopRequested(jobId)) {
        await jobRepository.updateJob(jobId, {
          status: "stopped",
          currentLabel: null,
          finishedAt: now(),
        });
        return;
      }

      await jobRepository.updateJob(jobId, {
        currentLabel: `${order.orderNumber} を処理中...`,
      });

      const item = await jobRepository.createItem({
        jobId,
        orderId: order.id,
        carrier: CARRIER.CLICKPOST,
        status: "running",
      });

      try {
        await processOrderItem(jobId, item.id, order, options);
        successCount += 1;
        await jobRepository.updateItem(item.id, { status: "success", processedAt: now() });
      } catch (error) {
        failureCount += 1;
        await jobRepository.updateItem(item.id, {
          status: "failed",
          processedAt: now(),
          errorMessage: error instanceof Error ? error.message : "unknown error",
        });
      }

      await jobRepository.updateJob(jobId, {
        successCount,
        failureCount,
        progressPercentage: Math.round(((index + 1) / orders.length) * 100),
      });
    }

    await jobRepository.updateJob(jobId, {
      status: failureCount > 0 ? "failed" : "success",
      currentLabel: null,
      finishedAt: now(),
    });
  }

  async function processOrderItem(
    jobId: string,
    jobItemId: string,
    order: OrderDTO,
    options: RunRakutenClickPostOptions
  ): Promise<void> {
    const orderProgress = Number(order.orderStatus);
    const confirmationRequired = isOrderConfirmationRequired(orderProgress);

    const confirmStep = await jobRepository.createStep({
      jobId,
      jobItemId,
      stepKey: STEP_KEY.RMS_ORDER_CONFIRM,
      status: confirmationRequired ? "running" : "skipped",
      startedAt: now(),
    });

    if (confirmationRequired) {
      const result = await rmsService.confirmOrder(order.orderNumber, orderProgress, {
        execute: options.rmsConfirmExecute ?? false,
      });

      await jobRepository.updateStep(confirmStep.id, {
        status: result.success ? "success" : "failed",
        finishedAt: now(),
        errorMessage: result.message ?? null,
      });

      if (!result.success) {
        throw new Error(`RMS注文確認に失敗しました: ${result.message ?? "unknown error"}`);
      }
    } else {
      await jobRepository.updateStep(confirmStep.id, { finishedAt: now() });
    }

    const registerStep = await jobRepository.createStep({
      jobId,
      jobItemId,
      stepKey: STEP_KEY.CLICKPOST_REGISTER,
      status: "running",
      startedAt: now(),
    });

    try {
      const fullOrder = await orderRepository.findById(order.id);
      if (!fullOrder) {
        throw new Error("Orderが見つかりませんでした");
      }

      const [result] = await clickPostService.registerOrders([fullOrder], {
        execute: options.clickPostExecute ?? false,
      });

      // execute:falseはドライラン(まとめ申込を実行していない)であり、失敗ではないため
      // "skipped"として記録する。実際にまとめ申込〜支払手続き画面まで到達した場合のみ"success"。
      await jobRepository.updateStep(registerStep.id, {
        status: result.reachedPaymentScreen ? "success" : "skipped",
        finishedAt: now(),
        errorMessage: result.reachedPaymentScreen
          ? null
          : "execute=falseのためClickPostへの登録は実行していません(ドライラン)",
      });

      // 状態ベースの処理対象判定(findClickPostTargetOrders)から外すため、成功時のみ記録する。
      if (result.reachedPaymentScreen) {
        await orderRepository.markClickPostRegistered(fullOrder.id, now());
      }
    } catch (error) {
      await jobRepository.updateStep(registerStep.id, {
        status: "failed",
        finishedAt: now(),
        errorMessage: error instanceof Error ? error.message : "unknown error",
      });
      throw error;
    }
  }

  return { run, executeJob };
}

// アプリ実運用向けのデフォルトファクトリ(実際のRmsService/ClickPostService/Repositoryを使用する)。
export function createDefaultRmsClickPostOrchestrator(): RmsClickPostOrchestrator {
  return createRmsClickPostOrchestrator({
    jobRepository: automationJobRepository,
    orderRepository,
    rmsService: createDefaultRmsService(),
    clickPostService: createDefaultClickPostService(),
  });
}
