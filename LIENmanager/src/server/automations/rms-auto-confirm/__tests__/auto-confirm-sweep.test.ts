import { describe, expect, it, vi } from "vitest";

import type { RmsService } from "@/server/integrations/rms/rms-service";
import type { OrderDTO } from "@/types/order";
import { runAutoConfirmSweep } from "../auto-confirm-sweep";

function buildOrderDTO(overrides: Partial<OrderDTO> = {}): OrderDTO {
  return {
    id: "order-1",
    channel: "rakuten",
    orderNumber: "order-1",
    ordererName: "テスト太郎",
    recipientName: "テスト太郎",
    postalCode: "1000001",
    prefecture: "東京都",
    address1: "千代田区1-1-1",
    address2: null,
    phoneNumber: null,
    email: null,
    shippingMethod: null,
    orderStatus: "100",
    orderedAt: new Date().toISOString(),
    totalPrice: null,
    paymentMethod: null,
    trackingNumber: null,
    rmsShippingReflectedAt: null,
    clickPostRegisteredAt: null,
    csvExportedAt: null,
    shippingReportedAt: null,
    heldAt: null,
    excludedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function buildFakeRmsService(overrides: Partial<RmsService> = {}): RmsService {
  return {
    fetchPendingOrders: vi.fn(async () => ({
      orders: [],
      totalFetched: 0,
      totalSynced: 0,
      errors: [],
    })),
    confirmOrder: vi.fn(),
    checkRmsLoginState: vi.fn(),
    verifyPendingConfirmationScreen: vi.fn(),
    ...overrides,
  } as unknown as RmsService;
}

// orchestrator.test.tsと同じパターンのインメモリ簡易フェイク。
function buildFakeJobRepository() {
  let jobSeq = 0;
  let itemSeq = 0;
  let stepSeq = 0;

  const jobs = new Map<string, Record<string, unknown>>();
  const items = new Map<string, Record<string, unknown>>();
  const steps = new Map<string, Record<string, unknown>>();

  return {
    jobs,
    items,
    steps,
    async createJob(data: Record<string, unknown>) {
      const id = `job-${++jobSeq}`;
      const job = { id, ...data };
      jobs.set(id, job);
      return job;
    },
    async updateJob(id: string, data: Record<string, unknown>) {
      const job = jobs.get(id) ?? {};
      const updated = { ...job, ...data };
      jobs.set(id, updated);
      return updated;
    },
    async createItem(data: Record<string, unknown>) {
      const id = `item-${++itemSeq}`;
      const item = { id, ...data };
      items.set(id, item);
      return item;
    },
    async updateItem(id: string, data: Record<string, unknown>) {
      const item = items.get(id) ?? {};
      const updated = { ...item, ...data };
      items.set(id, updated);
      return updated;
    },
    async createStep(data: Record<string, unknown>) {
      const id = `step-${++stepSeq}`;
      const step = { id, ...data };
      steps.set(id, step);
      return step;
    },
    async updateStep(id: string, data: Record<string, unknown>) {
      const step = steps.get(id) ?? {};
      const updated = { ...step, ...data };
      steps.set(id, updated);
      return updated;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("runAutoConfirmSweep", () => {
  it("fetchPendingOrdersをorderProgressList=[100]で呼び出す", async () => {
    const fetchPendingOrders = vi.fn(async () => ({
      orders: [],
      totalFetched: 0,
      totalSynced: 0,
      errors: [],
    }));
    await runAutoConfirmSweep(buildFakeRmsService({ fetchPendingOrders }));

    expect(fetchPendingOrders).toHaveBeenCalledWith({ orderProgressList: [100] });
  });

  it("orderStatus=100の注文それぞれにexecute:trueでconfirmOrderを呼び、AutomationJob/Item/Stepを記録する", async () => {
    const orders = [
      buildOrderDTO({ id: "o1", orderNumber: "o1", orderStatus: "100" }),
      buildOrderDTO({ id: "o2", orderNumber: "o2", orderStatus: "100" }),
    ];
    const confirmOrder = vi.fn(async () => ({
      orderNumber: "o1",
      wasRequired: true,
      found: true,
      executed: true,
      success: true,
    }));
    const jobRepository = buildFakeJobRepository();

    const result = await runAutoConfirmSweep(
      buildFakeRmsService({
        fetchPendingOrders: vi.fn(async () => ({
          orders,
          totalFetched: 2,
          totalSynced: 2,
          errors: [],
        })),
        confirmOrder,
      }),
      jobRepository
    );

    expect(confirmOrder).toHaveBeenCalledTimes(2);
    expect(confirmOrder).toHaveBeenCalledWith("o1", 100, { execute: true });
    expect(confirmOrder).toHaveBeenCalledWith("o2", 100, { execute: true });
    expect(result.checked).toBe(2);
    expect(result.confirmed).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.failureReasons).toEqual([]);
    expect(result.skipped).toBe(false);
    expect(result.jobId).toBeDefined();

    const job = jobRepository.jobs.get(result.jobId as string);
    expect(job?.status).toBe("success");
    expect(job?.successCount).toBe(2);
    expect(job?.moduleKey).toBe("rms_auto_confirm");
    expect(jobRepository.items.size).toBe(2);
    expect([...jobRepository.items.values()].every((item) => item.status === "success")).toBe(
      true
    );
    expect(
      [...jobRepository.steps.values()].every((step) => step.stepKey === "rms_order_confirm")
    ).toBe(true);
  });

  it("confirmOrderがsuccess:falseを返した場合はfailedとして数え、エラー内容をStep/Itemに記録する", async () => {
    const orders = [buildOrderDTO({ orderStatus: "100" })];
    const confirmOrder = vi.fn(async () => ({
      orderNumber: "order-1",
      wasRequired: true,
      found: false,
      executed: false,
      success: false,
      message: "対象注文が見つかりませんでした",
    }));
    const jobRepository = buildFakeJobRepository();

    const result = await runAutoConfirmSweep(
      buildFakeRmsService({
        fetchPendingOrders: vi.fn(async () => ({
          orders,
          totalFetched: 1,
          totalSynced: 1,
          errors: [],
        })),
        confirmOrder,
      }),
      jobRepository
    );

    expect(result.checked).toBe(1);
    expect(result.confirmed).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.failureReasons).toEqual(["対象注文が見つかりませんでした"]);

    const job = jobRepository.jobs.get(result.jobId as string);
    expect(job?.status).toBe("failed");
    const item = [...jobRepository.items.values()][0];
    expect(item.status).toBe("failed");
    expect(item.errorMessage).toBe("対象注文が見つかりませんでした");
  });

  it("confirmOrderが例外を投げてもスイープ全体は中断せずfailedとして数える", async () => {
    const orders = [
      buildOrderDTO({ id: "o1", orderNumber: "o1", orderStatus: "100" }),
      buildOrderDTO({ id: "o2", orderNumber: "o2", orderStatus: "100" }),
    ];
    const confirmOrder = vi
      .fn()
      .mockRejectedValueOnce(new Error("RMS API error"))
      .mockResolvedValueOnce({
        orderNumber: "o2",
        wasRequired: true,
        found: true,
        executed: true,
        success: true,
      });
    const jobRepository = buildFakeJobRepository();

    const result = await runAutoConfirmSweep(
      buildFakeRmsService({
        fetchPendingOrders: vi.fn(async () => ({
          orders,
          totalFetched: 2,
          totalSynced: 2,
          errors: [],
        })),
        confirmOrder,
      }),
      jobRepository
    );

    expect(result.checked).toBe(2);
    expect(result.confirmed).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.failureReasons).toEqual(["RMS API error"]);

    const job = jobRepository.jobs.get(result.jobId as string);
    expect(job?.status).toBe("failed");
    expect(job?.successCount).toBe(1);
    expect(job?.failureCount).toBe(1);
  });

  it("対象注文が0件の場合はJobを作らずエラーにもならずchecked:0を返す", async () => {
    const confirmOrder = vi.fn();
    const jobRepository = buildFakeJobRepository();

    const result = await runAutoConfirmSweep(buildFakeRmsService({ confirmOrder }), jobRepository);

    expect(confirmOrder).not.toHaveBeenCalled();
    expect(result).toEqual({
      checked: 0,
      confirmed: 0,
      failed: 0,
      failureReasons: [],
      skipped: false,
    });
    expect(jobRepository.jobs.size).toBe(0);
  });

  it("前回のスイープが実行中の場合は今回をスキップする(二重処理防止)", async () => {
    let resolveFirstFetch: (() => void) | undefined;
    const firstFetchStarted = new Promise<void>((resolve) => {
      resolveFirstFetch = resolve;
    });

    const orders = [buildOrderDTO({ orderStatus: "100" })];
    const confirmOrder = vi.fn(async () => ({
      orderNumber: "order-1",
      wasRequired: true,
      found: true,
      executed: true,
      success: true,
    }));

    const firstRmsService = buildFakeRmsService({
      fetchPendingOrders: vi.fn(async () => {
        resolveFirstFetch?.();
        // 1回目のスイープがまだ処理中の間に2回目を開始させるための遅延。
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { orders, totalFetched: 1, totalSynced: 1, errors: [] };
      }),
      confirmOrder,
    });

    const firstRun = runAutoConfirmSweep(firstRmsService, buildFakeJobRepository());
    await firstFetchStarted;

    const secondRun = runAutoConfirmSweep(
      buildFakeRmsService({ confirmOrder }),
      buildFakeJobRepository()
    );

    const [firstResult, secondResult] = await Promise.all([firstRun, secondRun]);

    expect(firstResult.skipped).toBe(false);
    expect(secondResult.skipped).toBe(true);
    expect(secondResult).toEqual({
      checked: 0,
      confirmed: 0,
      failed: 0,
      failureReasons: [],
      skipped: true,
    });
  });
});
