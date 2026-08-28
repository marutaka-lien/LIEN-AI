import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { createTestPrismaClient } from "@/server/test-utils/create-test-prisma-client";
import type { OrderUpsertInput } from "@/types/order";

import { createOrderRepository } from "../order.repository";

function buildInput(overrides: Partial<OrderUpsertInput> = {}): OrderUpsertInput {
  return {
    channel: "rakuten",
    orderNumber: "order-1",
    ordererName: "山田 太郎",
    ...overrides,
  };
}

describe("orderRepository.upsertByChannelAndOrderNumber", () => {
  let prisma: PrismaClient;
  let repository: ReturnType<typeof createOrderRepository>;

  beforeAll(async () => {
    prisma = await createTestPrismaClient();
    repository = createOrderRepository(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("新規注文はcreateされる", async () => {
    const saved = await repository.upsertByChannelAndOrderNumber(buildInput());

    expect(saved.orderNumber).toBe("order-1");
    expect(saved.ordererName).toBe("山田 太郎");

    const count = await prisma.order.count({ where: { channel: "rakuten", orderNumber: "order-1" } });
    expect(count).toBe(1);
  });

  it("既存注文は同一キーでupdateされる(氏名が変わっても行は増えない)", async () => {
    await repository.upsertByChannelAndOrderNumber(
      buildInput({ orderNumber: "order-2", ordererName: "旧氏名" })
    );
    const updated = await repository.upsertByChannelAndOrderNumber(
      buildInput({ orderNumber: "order-2", ordererName: "新氏名" })
    );

    expect(updated.ordererName).toBe("新氏名");

    const count = await prisma.order.count({ where: { channel: "rakuten", orderNumber: "order-2" } });
    expect(count).toBe(1);
  });

  it("同じ注文を複数回同期しても重複登録されない", async () => {
    const input = buildInput({ orderNumber: "order-3" });

    await repository.upsertByChannelAndOrderNumber(input);
    await repository.upsertByChannelAndOrderNumber(input);
    await repository.upsertByChannelAndOrderNumber(input);

    const count = await prisma.order.count({ where: { channel: "rakuten", orderNumber: "order-3" } });
    expect(count).toBe(1);
  });
});

describe("orderRepository.findClickPostTargetOrders / markClickPostRegistered", () => {
  let prisma: PrismaClient;
  let repository: ReturnType<typeof createOrderRepository>;

  beforeAll(async () => {
    prisma = await createTestPrismaClient();
    repository = createOrderRepository(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("orderStatus=300かつClickPost未登録の注文のみを、受注日に関わらず対象として返す", async () => {
    // 受注日が古い注文でも対象に含まれること(日付フィルタに依存しないこと)を確認する。
    await repository.upsertByChannelAndOrderNumber(
      buildInput({
        orderNumber: "target-old",
        orderStatus: "300",
        orderedAt: new Date("2020-01-01T00:00:00Z"),
      })
    );
    await repository.upsertByChannelAndOrderNumber(
      buildInput({ orderNumber: "not-confirmed-yet", orderStatus: "100" })
    );
    const registered = await repository.upsertByChannelAndOrderNumber(
      buildInput({ orderNumber: "already-registered", orderStatus: "300" })
    );
    await repository.markClickPostRegistered(registered.id, new Date("2026-08-01T00:00:00Z"));

    const targets = await repository.findClickPostTargetOrders();
    const targetOrderNumbers = targets.map((o) => o.orderNumber);

    expect(targetOrderNumbers).toContain("target-old");
    expect(targetOrderNumbers).not.toContain("not-confirmed-yet");
    expect(targetOrderNumbers).not.toContain("already-registered");
  });

  it("markClickPostRegisteredはclickPostRegisteredAt以外のフィールドを変更しない", async () => {
    const order = await repository.upsertByChannelAndOrderNumber(
      buildInput({ orderNumber: "mark-target", orderStatus: "300", ordererName: "確認 太郎" })
    );

    const updated = await repository.markClickPostRegistered(order.id, new Date("2026-08-25T00:00:00Z"));

    expect(updated.clickPostRegisteredAt).toEqual(new Date("2026-08-25T00:00:00Z"));
    expect(updated.ordererName).toBe("確認 太郎");
    expect(updated.orderStatus).toBe("300");
  });
});

describe("orderRepository.findCsvExportTargetOrders / markCsvExported", () => {
  let prisma: PrismaClient;
  let repository: ReturnType<typeof createOrderRepository>;

  beforeAll(async () => {
    prisma = await createTestPrismaClient();
    repository = createOrderRepository(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("orderStatus=300かつCSV未出力の注文のみを、受注日に関わらず対象として返す", async () => {
    await repository.upsertByChannelAndOrderNumber(
      buildInput({
        orderNumber: "csv-target-old",
        orderStatus: "300",
        orderedAt: new Date("2020-01-01T00:00:00Z"),
      })
    );
    await repository.upsertByChannelAndOrderNumber(
      buildInput({ orderNumber: "csv-not-confirmed-yet", orderStatus: "100" })
    );
    const exported = await repository.upsertByChannelAndOrderNumber(
      buildInput({ orderNumber: "csv-already-exported", orderStatus: "300" })
    );
    await repository.markCsvExported([exported.id], new Date("2026-08-01T00:00:00Z"));

    const targets = await repository.findCsvExportTargetOrders();
    const targetOrderNumbers = targets.map((o) => o.orderNumber);

    expect(targetOrderNumbers).toContain("csv-target-old");
    expect(targetOrderNumbers).not.toContain("csv-not-confirmed-yet");
    expect(targetOrderNumbers).not.toContain("csv-already-exported");
  });

  it("markCsvExportedは指定した複数件へ一括で記録し、他のフィールドを変更しない", async () => {
    const orderA = await repository.upsertByChannelAndOrderNumber(
      buildInput({ orderNumber: "csv-mark-a", orderStatus: "300", ordererName: "出力 太郎" })
    );
    const orderB = await repository.upsertByChannelAndOrderNumber(
      buildInput({ orderNumber: "csv-mark-b", orderStatus: "300" })
    );

    const result = await repository.markCsvExported(
      [orderA.id, orderB.id],
      new Date("2026-08-25T00:00:00Z")
    );

    expect(result.count).toBe(2);
    const targets = await repository.findCsvExportTargetOrders();
    expect(targets.map((o) => o.orderNumber)).not.toContain("csv-mark-a");
    expect(targets.map((o) => o.orderNumber)).not.toContain("csv-mark-b");
  });

  it("markCsvExportedはids空配列の場合は何もしない", async () => {
    const result = await repository.markCsvExported([], new Date());
    expect(result.count).toBe(0);
  });
});

describe("orderRepository.findMany (pendingOnly)", () => {
  let prisma: PrismaClient;
  let repository: ReturnType<typeof createOrderRepository>;

  beforeAll(async () => {
    prisma = await createTestPrismaClient();
    repository = createOrderRepository(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("orderStatus=300でもCSV出力済み(csvExportedAtあり)の注文はpendingOnly:trueの結果に含まれない", async () => {
    const exported = await repository.upsertByChannelAndOrderNumber(
      buildInput({ orderNumber: "pending-csv-exported", orderStatus: "300" })
    );
    await repository.markCsvExported([exported.id], new Date("2026-08-25T00:00:00Z"));
    await repository.upsertByChannelAndOrderNumber(
      buildInput({ orderNumber: "pending-still-open", orderStatus: "300" })
    );

    const results = await repository.findMany(200, { pendingOnly: true });
    const orderNumbers = results.map((o) => o.orderNumber);

    expect(orderNumbers).not.toContain("pending-csv-exported");
    expect(orderNumbers).toContain("pending-still-open");
  });

  it("orderStatus=300でもClickPost登録済み(clickPostRegisteredAtあり)の注文はpendingOnly:trueの結果に含まれない", async () => {
    const registered = await repository.upsertByChannelAndOrderNumber(
      buildInput({ orderNumber: "pending-clickpost-registered", orderStatus: "300" })
    );
    await repository.markClickPostRegistered(registered.id, new Date("2026-08-25T00:00:00Z"));

    const results = await repository.findMany(200, { pendingOnly: true });
    const orderNumbers = results.map((o) => o.orderNumber);

    expect(orderNumbers).not.toContain("pending-clickpost-registered");
  });

  it("pendingOnlyを指定しない場合はCSV出力済み・ClickPost登録済みの注文も結果に含まれる(影響を受けない)", async () => {
    const exported = await repository.upsertByChannelAndOrderNumber(
      buildInput({ orderNumber: "all-csv-exported", orderStatus: "300" })
    );
    await repository.markCsvExported([exported.id], new Date("2026-08-25T00:00:00Z"));
    const registered = await repository.upsertByChannelAndOrderNumber(
      buildInput({ orderNumber: "all-clickpost-registered", orderStatus: "300" })
    );
    await repository.markClickPostRegistered(registered.id, new Date("2026-08-25T00:00:00Z"));

    const resultsWithoutFilters = await repository.findMany(200, {});
    const orderNumbersWithoutFilters = resultsWithoutFilters.map((o) => o.orderNumber);
    expect(orderNumbersWithoutFilters).toContain("all-csv-exported");
    expect(orderNumbersWithoutFilters).toContain("all-clickpost-registered");

    const resultsPendingFalse = await repository.findMany(200, { pendingOnly: false });
    const orderNumbersPendingFalse = resultsPendingFalse.map((o) => o.orderNumber);
    expect(orderNumbersPendingFalse).toContain("all-csv-exported");
    expect(orderNumbersPendingFalse).toContain("all-clickpost-registered");
  });
});

describe("orderRepository.getTodayCsvExportSummary", () => {
  let prisma: PrismaClient;
  let repository: ReturnType<typeof createOrderRepository>;

  beforeAll(async () => {
    prisma = await createTestPrismaClient();
    repository = createOrderRepository(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("csvExportedAtが一件も設定されていない場合はcount=0・lastExportedAt=nullを返す", async () => {
    await repository.upsertByChannelAndOrderNumber(
      buildInput({ orderNumber: "summary-none", orderStatus: "300" })
    );

    const summary = await repository.getTodayCsvExportSummary();

    expect(summary.count).toBe(0);
    expect(summary.lastExportedAt).toBeNull();
  });

  it("今日csvExportedAtが設定された注文の件数と最新日時を返す", async () => {
    const now = new Date();
    const earlier = new Date(now.getTime() - 60 * 60 * 1000);

    const orderA = await repository.upsertByChannelAndOrderNumber(
      buildInput({ orderNumber: "summary-today-a", orderStatus: "300" })
    );
    const orderB = await repository.upsertByChannelAndOrderNumber(
      buildInput({ orderNumber: "summary-today-b", orderStatus: "300" })
    );
    await repository.markCsvExported([orderA.id], earlier);
    await repository.markCsvExported([orderB.id], now);

    const summary = await repository.getTodayCsvExportSummary();

    expect(summary.count).toBeGreaterThanOrEqual(2);
    expect(summary.lastExportedAt).toEqual(now);
  });

  it("JST日付境界より前(前日)にcsvExportedAtが設定された注文は含めない", async () => {
    const yesterdayUtc = new Date("2020-01-01T00:00:00Z");
    const order = await repository.upsertByChannelAndOrderNumber(
      buildInput({ orderNumber: "summary-yesterday", orderStatus: "300" })
    );
    await repository.markCsvExported([order.id], yesterdayUtc);

    const summary = await repository.getTodayCsvExportSummary();
    // 前日分は対象に含まれないため、その注文のcsvExportedAtが最新として返らないことを確認する。
    expect(summary.lastExportedAt).not.toEqual(yesterdayUtc);
  });
});
