import { describe, expect, it, vi } from "vitest";

import type { Order } from "@/generated/prisma/client";
import type { ClickPostService } from "@/server/integrations/clickpost/clickpost-service";
import type { RmsService } from "@/server/integrations/rms/rms-service";
import type { OrderDTO } from "@/types/order";

import { createRmsClickPostOrchestrator } from "../orchestrator";

function buildOrderDTO(overrides: Partial<OrderDTO> = {}): OrderDTO {
  return {
    id: "order-1",
    channel: "rakuten",
    orderNumber: "333267-20260722-0000000001",
    ordererName: "山田 太郎",
    recipientName: "山田 太郎",
    postalCode: "150-0001",
    prefecture: "東京都",
    address1: "渋谷区神宮前1-1-1",
    address2: null,
    phoneNumber: "0312345678",
    email: "test@example.com",
    shippingMethod: "追跡可能メール便",
    orderStatus: "300",
    orderedAt: "2026-07-22T00:00:00.000Z",
    totalPrice: null,
    paymentMethod: null,
    trackingNumber: null,
    rmsShippingReflectedAt: null,
    clickPostRegisteredAt: null,
    csvExportedAt: null,
    shippingReportedAt: null,
    heldAt: null,
    excludedAt: null,
    createdAt: "2026-07-22T00:00:00.000Z",
    updatedAt: "2026-07-22T00:00:00.000Z",
    ...overrides,
  };
}

function buildFullOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-1",
    channel: "rakuten",
    orderNumber: "333267-20260722-0000000001",
    ordererName: "山田 太郎",
    recipientName: "山田 太郎",
    postalCode: "150-0001",
    prefecture: "東京都",
    address1: "渋谷区神宮前1-1-1",
    address2: null,
    phoneNumber: "0312345678",
    email: "test@example.com",
    shippingMethod: "追跡可能メール便",
    orderStatus: "300",
    orderedAt: new Date("2026-07-22T00:00:00Z"),
    totalPrice: null,
    paymentMethod: null,
    trackingNumber: null,
    rmsShippingReflectedAt: null,
    clickPostRegisteredAt: null,
    csvExportedAt: null,
    shippingReportedAt: null,
    heldAt: null,
    excludedAt: null,
    rawPayload: null,
    createdAt: new Date("2026-07-22T00:00:00Z"),
    updatedAt: new Date("2026-07-22T00:00:00Z"),
    ...overrides,
  };
}

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
      const job = { id, stopRequested: false, ...data };
      jobs.set(id, job);
      return job;
    },
    async updateJob(id: string, data: Record<string, unknown>) {
      const job = jobs.get(id) ?? {};
      const updated = { ...job, ...data };
      jobs.set(id, updated);
      return updated;
    },
    async isStopRequested(id: string) {
      return Boolean(jobs.get(id)?.stopRequested);
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

function buildFakeOrderRepository(ordersById: Record<string, Order>) {
  return {
    async findById(id: string) {
      return ordersById[id] ?? null;
    },
    // 実装(order.repository.ts)と同じ判定: orderStatus=300 かつ 未登録のみ対象。
    async findClickPostTargetOrders() {
      return Object.values(ordersById).filter(
        (order) => order.orderStatus === "300" && !order.clickPostRegisteredAt
      );
    },
    async markClickPostRegistered(id: string, registeredAt: Date) {
      const order = ordersById[id];
      if (order) order.clickPostRegisteredAt = registeredAt;
      return order;
    },
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

function buildFakeClickPostService(overrides: Partial<ClickPostService> = {}): ClickPostService {
  return {
    dryRunMapOrders: vi.fn(),
    registerOrders: vi.fn(async () => {
      throw new Error("ClickPostは未実装です");
    }),
    ...overrides,
  } as unknown as ClickPostService;
}

describe("RmsClickPostOrchestrator.executeJob", () => {
  it("注文が0件の場合はjobを即成功として終了する", async () => {
    const jobRepository = buildFakeJobRepository();
    const orchestrator = createRmsClickPostOrchestrator({
      jobRepository,
      orderRepository: buildFakeOrderRepository({}),
      rmsService: buildFakeRmsService(),
      clickPostService: buildFakeClickPostService(),
    });

    const job = await jobRepository.createJob({ moduleKey: "rakuten_clickpost", status: "running" });
    await orchestrator.executeJob(job.id);

    expect(jobRepository.jobs.get(job.id)?.status).toBe("success");
    expect(jobRepository.jobs.get(job.id)?.totalCount).toBe(0);
  });

  it("orderProgress>=200(確認不要)の場合はRMS注文確認をスキップしClickPost登録へ進む", async () => {
    const jobRepository = buildFakeJobRepository();
    const order = buildOrderDTO({ orderStatus: "300" });
    const confirmOrder = vi.fn();
    const registerOrders = vi.fn(async () => [
      { orderNumber: order.orderNumber, reachedPaymentScreen: true },
    ]);

    const orchestrator = createRmsClickPostOrchestrator({
      jobRepository,
      orderRepository: buildFakeOrderRepository({ "order-1": buildFullOrder() }),
      rmsService: buildFakeRmsService({
        fetchPendingOrders: vi.fn(async () => ({
          orders: [order],
          totalFetched: 1,
          totalSynced: 1,
          errors: [],
        })),
        confirmOrder,
      }),
      clickPostService: buildFakeClickPostService({ registerOrders }),
    });

    const job = await jobRepository.createJob({ moduleKey: "rakuten_clickpost", status: "running" });
    await orchestrator.executeJob(job.id);

    expect(confirmOrder).not.toHaveBeenCalled();
    expect(registerOrders).toHaveBeenCalledTimes(1);
    expect(jobRepository.jobs.get(job.id)?.status).toBe("success");
    expect(jobRepository.jobs.get(job.id)?.successCount).toBe(1);

    const confirmStep = [...jobRepository.steps.values()].find(
      (step) => step.stepKey === "rms_order_confirm"
    );
    expect(confirmStep?.status).toBe("skipped");
  });

  it("orderProgress=100(確認待ち)の場合はRMS注文確認を実行してから登録へ進む(選択実行時)", async () => {
    // 状態ベースの自動対象判定(findClickPostTargetOrders)はorderStatus=300のみを拾うため、
    // 100(確認待ち)の注文が処理対象になるのは選択実行(orderNumbers指定)の場合のみ
    // (発送エントリー画面の「本日の処理待ち注文者」一覧から人が選んだ場合を想定)。
    const jobRepository = buildFakeJobRepository();
    const order = buildOrderDTO({ orderStatus: "100" });
    const confirmOrder = vi.fn(async () => ({
      orderNumber: order.orderNumber,
      wasRequired: true,
      found: true,
      executed: false,
      success: true,
    }));
    const registerOrders = vi.fn(async () => [
      { orderNumber: order.orderNumber, reachedPaymentScreen: true },
    ]);

    const orchestrator = createRmsClickPostOrchestrator({
      jobRepository,
      orderRepository: buildFakeOrderRepository({ "order-1": buildFullOrder({ orderStatus: "100" }) }),
      rmsService: buildFakeRmsService({
        fetchPendingOrders: vi.fn(async () => ({
          orders: [order],
          totalFetched: 1,
          totalSynced: 1,
          errors: [],
        })),
        confirmOrder,
      }),
      clickPostService: buildFakeClickPostService({ registerOrders }),
    });

    const job = await jobRepository.createJob({ moduleKey: "rakuten_clickpost", status: "running" });
    await orchestrator.executeJob(job.id, {
      rmsConfirmExecute: false,
      orderNumbers: [order.orderNumber],
    });

    expect(confirmOrder).toHaveBeenCalledWith(order.orderNumber, 100, { execute: false });
    expect(registerOrders).toHaveBeenCalledTimes(1);
    expect(jobRepository.jobs.get(job.id)?.status).toBe("success");
  });

  it("状態ベースの対象判定: orderStatus=300かつClickPost未登録の注文のみを、受注日に関わらず対象にする", async () => {
    // 2026-08-25経営判断: 「今日受注したか」という日付フィルタには一切依存しないことの確認。
    // 受注日が古い注文(古い注文A)・ClickPost登録済みの注文(登録済み)は対象から除外され、
    // 未登録の発送待ち注文(古い注文B)だけが処理される。
    const jobRepository = buildFakeJobRepository();
    const registerOrders = vi.fn(async (orders: Order[]) =>
      orders.map((o) => ({ orderNumber: o.orderNumber, reachedPaymentScreen: true }))
    );

    const orchestrator = createRmsClickPostOrchestrator({
      jobRepository,
      orderRepository: buildFakeOrderRepository({
        "old-unregistered": buildFullOrder({
          id: "old-unregistered",
          orderNumber: "old-unregistered",
          orderStatus: "300",
          orderedAt: new Date("2020-01-01T00:00:00Z"),
          clickPostRegisteredAt: null,
        }),
        "already-registered": buildFullOrder({
          id: "already-registered",
          orderNumber: "already-registered",
          orderStatus: "300",
          clickPostRegisteredAt: new Date("2026-08-01T00:00:00Z"),
        }),
        "awaiting-confirm": buildFullOrder({
          id: "awaiting-confirm",
          orderNumber: "awaiting-confirm",
          orderStatus: "100",
          clickPostRegisteredAt: null,
        }),
      }),
      // fetchPendingOrdersの戻り値は全件実行時の対象判定には使われないことの確認を兼ね、
      // あえて空を返す(RMS検索の日付窓に対象判定が引きずられないことを検証)。
      rmsService: buildFakeRmsService({
        fetchPendingOrders: vi.fn(async () => ({ orders: [], totalFetched: 0, totalSynced: 0, errors: [] })),
      }),
      clickPostService: buildFakeClickPostService({ registerOrders }),
    });

    const job = await jobRepository.createJob({ moduleKey: "rakuten_clickpost", status: "running" });
    await orchestrator.executeJob(job.id);

    expect(jobRepository.jobs.get(job.id)?.totalCount).toBe(1);
    expect(registerOrders).toHaveBeenCalledTimes(1);
    expect(jobRepository.items.size).toBe(1);
    expect([...jobRepository.items.values()][0].orderId).toBe("old-unregistered");
  });

  it("ClickPost登録がドライラン(reachedPaymentScreen:false)の場合はskippedとして記録し失敗扱いにしない", async () => {
    const jobRepository = buildFakeJobRepository();
    const order = buildOrderDTO({ orderStatus: "300" });
    const registerOrders = vi.fn(async () => [
      { orderNumber: order.orderNumber, reachedPaymentScreen: false },
    ]);

    const orchestrator = createRmsClickPostOrchestrator({
      jobRepository,
      orderRepository: buildFakeOrderRepository({ "order-1": buildFullOrder() }),
      rmsService: buildFakeRmsService({
        fetchPendingOrders: vi.fn(async () => ({
          orders: [order],
          totalFetched: 1,
          totalSynced: 1,
          errors: [],
        })),
      }),
      clickPostService: buildFakeClickPostService({ registerOrders }),
    });

    const job = await jobRepository.createJob({ moduleKey: "rakuten_clickpost", status: "running" });
    await orchestrator.executeJob(job.id);

    expect(jobRepository.jobs.get(job.id)?.status).toBe("success");
    expect(jobRepository.jobs.get(job.id)?.successCount).toBe(1);

    const registerStep = [...jobRepository.steps.values()].find(
      (step) => step.stepKey === "clickpost_register"
    );
    expect(registerStep?.status).toBe("skipped");
  });

  it("RMS注文確認が失敗した場合はClickPost登録を行わずitemをfailedにする(選択実行時)", async () => {
    const jobRepository = buildFakeJobRepository();
    const order = buildOrderDTO({ orderStatus: "100" });
    const confirmOrder = vi.fn(async () => ({
      orderNumber: order.orderNumber,
      wasRequired: true,
      found: true,
      executed: false,
      success: false,
      message: "対象注文が見つかりませんでした",
    }));
    const registerOrders = vi.fn(async () => []);

    const orchestrator = createRmsClickPostOrchestrator({
      jobRepository,
      orderRepository: buildFakeOrderRepository({ "order-1": buildFullOrder() }),
      rmsService: buildFakeRmsService({
        fetchPendingOrders: vi.fn(async () => ({
          orders: [order],
          totalFetched: 1,
          totalSynced: 1,
          errors: [],
        })),
        confirmOrder,
      }),
      clickPostService: buildFakeClickPostService({ registerOrders }),
    });

    const job = await jobRepository.createJob({ moduleKey: "rakuten_clickpost", status: "running" });
    await orchestrator.executeJob(job.id, { orderNumbers: [order.orderNumber] });

    expect(registerOrders).not.toHaveBeenCalled();
    expect(jobRepository.jobs.get(job.id)?.status).toBe("failed");
    expect(jobRepository.jobs.get(job.id)?.failureCount).toBe(1);

    const item = [...jobRepository.items.values()][0];
    expect(item.status).toBe("failed");
  });

  it("ClickPost登録が未実装エラーで失敗してもjob全体はfailedとして記録され例外を投げない", async () => {
    const jobRepository = buildFakeJobRepository();
    const order = buildOrderDTO({ orderStatus: "300" });

    const orchestrator = createRmsClickPostOrchestrator({
      jobRepository,
      orderRepository: buildFakeOrderRepository({ "order-1": buildFullOrder() }),
      rmsService: buildFakeRmsService({
        fetchPendingOrders: vi.fn(async () => ({
          orders: [order],
          totalFetched: 1,
          totalSynced: 1,
          errors: [],
        })),
      }),
      // デフォルトのclickPostServiceはregisterOrdersが必ず例外を投げる(現状の実装通り)。
      clickPostService: buildFakeClickPostService(),
    });

    const job = await jobRepository.createJob({ moduleKey: "rakuten_clickpost", status: "running" });
    await expect(orchestrator.executeJob(job.id)).resolves.toBeUndefined();

    expect(jobRepository.jobs.get(job.id)?.status).toBe("failed");
    expect(jobRepository.jobs.get(job.id)?.failureCount).toBe(1);

    const registerStep = [...jobRepository.steps.values()].find(
      (step) => step.stepKey === "clickpost_register"
    );
    expect(registerStep?.status).toBe("failed");
  });

  it("fetchPendingOrdersが失敗した場合はjobとfetchStepをfailedにする", async () => {
    const jobRepository = buildFakeJobRepository();

    const orchestrator = createRmsClickPostOrchestrator({
      jobRepository,
      orderRepository: buildFakeOrderRepository({}),
      rmsService: buildFakeRmsService({
        fetchPendingOrders: vi.fn(async () => {
          throw new Error("RMS API error");
        }),
      }),
      clickPostService: buildFakeClickPostService(),
    });

    const job = await jobRepository.createJob({ moduleKey: "rakuten_clickpost", status: "running" });
    await orchestrator.executeJob(job.id);

    expect(jobRepository.jobs.get(job.id)?.status).toBe("failed");
    const fetchStep = [...jobRepository.steps.values()].find((step) => step.stepKey === "rms_fetch");
    expect(fetchStep?.status).toBe("failed");
  });

  it("orderNumbersを指定した場合は取得した注文のうち一致するものだけを処理する(選択実行)", async () => {
    const jobRepository = buildFakeJobRepository();
    const orders = [
      buildOrderDTO({ id: "order-1", orderNumber: "order-1", orderStatus: "300" }),
      buildOrderDTO({ id: "order-2", orderNumber: "order-2", orderStatus: "300" }),
    ];
    const registerOrders = vi.fn(async () => [
      { orderNumber: "order-2", reachedPaymentScreen: true },
    ]);

    const orchestrator = createRmsClickPostOrchestrator({
      jobRepository,
      orderRepository: buildFakeOrderRepository({
        "order-1": buildFullOrder({ id: "order-1" }),
        "order-2": buildFullOrder({ id: "order-2" }),
      }),
      rmsService: buildFakeRmsService({
        fetchPendingOrders: vi.fn(async () => ({
          orders,
          totalFetched: 2,
          totalSynced: 2,
          errors: [],
        })),
      }),
      clickPostService: buildFakeClickPostService({ registerOrders }),
    });

    const job = await jobRepository.createJob({ moduleKey: "rakuten_clickpost", status: "running" });
    await orchestrator.executeJob(job.id, { orderNumbers: ["order-2"] });

    expect(jobRepository.jobs.get(job.id)?.totalCount).toBe(1);
    expect(registerOrders).toHaveBeenCalledTimes(1);
    expect(jobRepository.items.size).toBe(1);
    expect([...jobRepository.items.values()][0].orderId).toBe("order-2");
  });

  it("stopRequestedがtrueの場合は途中でjobをstoppedにして処理を中断する", async () => {
    const jobRepository = buildFakeJobRepository();
    const orders = [
      buildOrderDTO({ id: "order-1", orderNumber: "order-1", orderStatus: "300" }),
      buildOrderDTO({ id: "order-2", orderNumber: "order-2", orderStatus: "300" }),
    ];

    const orchestrator = createRmsClickPostOrchestrator({
      jobRepository,
      orderRepository: buildFakeOrderRepository({
        "order-1": buildFullOrder({ id: "order-1" }),
        "order-2": buildFullOrder({ id: "order-2" }),
      }),
      rmsService: buildFakeRmsService({
        fetchPendingOrders: vi.fn(async () => ({
          orders,
          totalFetched: 2,
          totalSynced: 2,
          errors: [],
        })),
      }),
      clickPostService: buildFakeClickPostService({ registerOrders: vi.fn(async () => []) }),
    });

    const job = await jobRepository.createJob({
      moduleKey: "rakuten_clickpost",
      status: "running",
      stopRequested: true,
    });
    await orchestrator.executeJob(job.id);

    expect(jobRepository.jobs.get(job.id)?.status).toBe("stopped");
    expect(jobRepository.items.size).toBe(0);
  });
});

describe("RmsClickPostOrchestrator.run", () => {
  it("Jobを作成してjobIdを即座に返す(完了を待たない)", async () => {
    const jobRepository = buildFakeJobRepository();

    const orchestrator = createRmsClickPostOrchestrator({
      jobRepository,
      orderRepository: buildFakeOrderRepository({}),
      rmsService: buildFakeRmsService(),
      clickPostService: buildFakeClickPostService(),
    });

    const jobId = await orchestrator.run();

    expect(jobId).toBeTruthy();
    expect(jobRepository.jobs.get(jobId)).toBeDefined();
  });
});
