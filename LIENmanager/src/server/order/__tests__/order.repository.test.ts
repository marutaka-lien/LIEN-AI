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

  it("一時保存中(heldAtあり)の注文はCSV作成の全件対象から除外される(2026-09-10発送ページ集約)", async () => {
    const held = await repository.upsertByChannelAndOrderNumber(
      buildInput({ orderNumber: "csv-held", orderStatus: "300" })
    );
    await repository.setHeld(held.id, new Date());
    await repository.upsertByChannelAndOrderNumber(
      buildInput({ orderNumber: "csv-not-held", orderStatus: "300" })
    );

    const targets = await repository.findCsvExportTargetOrders();
    const targetOrderNumbers = targets.map((o) => o.orderNumber);

    expect(targetOrderNumbers).not.toContain("csv-held");
    expect(targetOrderNumbers).toContain("csv-not-held");
  });

  it("対象外(excludedAtあり)の注文はCSV作成の全件対象から除外される(2026-09-15)", async () => {
    const excluded = await repository.upsertByChannelAndOrderNumber(
      buildInput({ orderNumber: "csv-excluded", orderStatus: "300" })
    );
    await repository.setExcluded(excluded.id, new Date());
    await repository.upsertByChannelAndOrderNumber(
      buildInput({ orderNumber: "csv-not-excluded", orderStatus: "300" })
    );

    const targets = await repository.findCsvExportTargetOrders();
    const targetOrderNumbers = targets.map((o) => o.orderNumber);

    expect(targetOrderNumbers).not.toContain("csv-excluded");
    expect(targetOrderNumbers).toContain("csv-not-excluded");
  });
});

describe("orderRepository.setHeld / setHeldMany", () => {
  let prisma: PrismaClient;
  let repository: ReturnType<typeof createOrderRepository>;

  beforeAll(async () => {
    prisma = await createTestPrismaClient();
    repository = createOrderRepository(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("setHeldはheldAtだけを更新する", async () => {
    const order = await repository.upsertByChannelAndOrderNumber(
      buildInput({ orderNumber: "hold-single", orderStatus: "300", ordererName: "保留 花子" })
    );

    const held = await repository.setHeld(order.id, new Date("2026-09-10T01:00:00Z"));
    expect(held.heldAt).toEqual(new Date("2026-09-10T01:00:00Z"));
    expect(held.ordererName).toBe("保留 花子");

    const unheld = await repository.setHeld(order.id, null);
    expect(unheld.heldAt).toBeNull();
  });

  it("setHeldManyは複数件を一括で更新し、空配列では何もしない", async () => {
    const a = await repository.upsertByChannelAndOrderNumber(
      buildInput({ orderNumber: "hold-many-a", orderStatus: "300" })
    );
    const b = await repository.upsertByChannelAndOrderNumber(
      buildInput({ orderNumber: "hold-many-b", orderStatus: "300" })
    );

    const result = await repository.setHeldMany([a.id, b.id], new Date());
    expect(result.count).toBe(2);

    const empty = await repository.setHeldMany([], new Date());
    expect(empty.count).toBe(0);
  });
});

describe("orderRepository.setExcluded / setExcludedMany", () => {
  let prisma: PrismaClient;
  let repository: ReturnType<typeof createOrderRepository>;

  beforeAll(async () => {
    prisma = await createTestPrismaClient();
    repository = createOrderRepository(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("setExcludedはexcludedAtだけを更新する", async () => {
    const order = await repository.upsertByChannelAndOrderNumber(
      buildInput({ orderNumber: "exclude-single", orderStatus: "300", ordererName: "対象外 花子" })
    );

    const excluded = await repository.setExcluded(order.id, new Date("2026-09-15T01:00:00Z"));
    expect(excluded.excludedAt).toEqual(new Date("2026-09-15T01:00:00Z"));
    expect(excluded.ordererName).toBe("対象外 花子");

    const restored = await repository.setExcluded(order.id, null);
    expect(restored.excludedAt).toBeNull();
  });

  it("setExcludedManyは複数件を一括で更新し、空配列では何もしない", async () => {
    const a = await repository.upsertByChannelAndOrderNumber(
      buildInput({ orderNumber: "exclude-many-a", orderStatus: "300" })
    );
    const b = await repository.upsertByChannelAndOrderNumber(
      buildInput({ orderNumber: "exclude-many-b", orderStatus: "300" })
    );

    const result = await repository.setExcludedMany([a.id, b.id], new Date());
    expect(result.count).toBe(2);

    const empty = await repository.setExcludedMany([], new Date());
    expect(empty.count).toBe(0);
  });
});

describe("orderRepository.countShippingSegments / findSegmentOrders", () => {
  let prisma: PrismaClient;
  let repository: ReturnType<typeof createOrderRepository>;

  beforeAll(async () => {
    prisma = await createTestPrismaClient();
    repository = createOrderRepository(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("6セグメントの判定条件どおりに件数・一覧を返す", async () => {
    const now = new Date("2026-09-10T12:00:00Z");
    const withinWeek = new Date("2026-09-08T00:00:00Z");
    const overWeek = new Date("2026-08-01T00:00:00Z");

    await repository.upsertByChannelAndOrderNumber(
      buildInput({ orderNumber: "seg-awaiting", orderStatus: "100" })
    );
    await repository.upsertByChannelAndOrderNumber(
      buildInput({ orderNumber: "seg-unprocessed", orderStatus: "300" })
    );

    const heldOne = await repository.upsertByChannelAndOrderNumber(
      buildInput({ orderNumber: "seg-held", orderStatus: "300" })
    );
    await repository.setHeld(heldOne.id, now);

    const inProgressOne = await repository.upsertByChannelAndOrderNumber(
      buildInput({ orderNumber: "seg-in-progress", orderStatus: "300" })
    );
    await repository.markCsvExported([inProgressOne.id], withinWeek);

    const inProgressOld = await repository.upsertByChannelAndOrderNumber(
      buildInput({ orderNumber: "seg-in-progress-old", orderStatus: "300" })
    );
    await repository.markCsvExported([inProgressOld.id], overWeek);

    const doneOne = await repository.upsertByChannelAndOrderNumber(
      buildInput({ orderNumber: "seg-done", orderStatus: "300" })
    );
    await repository.markCsvExported([doneOne.id], withinWeek);
    await repository.markShippingReported([doneOne.id], withinWeek);

    const excludedFromUnprocessed = await repository.upsertByChannelAndOrderNumber(
      buildInput({ orderNumber: "seg-excluded-unprocessed", orderStatus: "300" })
    );
    await repository.setExcluded(excludedFromUnprocessed.id, now);

    const excludedFromInProgress = await repository.upsertByChannelAndOrderNumber(
      buildInput({ orderNumber: "seg-excluded-in-progress", orderStatus: "300" })
    );
    await repository.markCsvExported([excludedFromInProgress.id], withinWeek);
    await repository.setExcluded(excludedFromInProgress.id, now);

    const counts = await repository.countShippingSegments(now);
    expect(counts.awaiting).toBeGreaterThanOrEqual(1);
    expect(counts.unprocessed).toBeGreaterThanOrEqual(1);
    expect(counts.inProgress).toBe(1); // 直近7日超のseg-in-progress-oldは含まない
    expect(counts.done).toBeGreaterThanOrEqual(1);
    expect(counts.held).toBeGreaterThanOrEqual(1);
    expect(counts.excluded).toBe(2);

    const heldRows = await repository.findSegmentOrders("held", 200, now);
    expect(heldRows.map((o) => o.orderNumber)).toContain("seg-held");

    const inProgressRows = await repository.findSegmentOrders("inProgress", 200, now);
    const inProgressOrderNumbers = inProgressRows.map((o) => o.orderNumber);
    expect(inProgressOrderNumbers).toContain("seg-in-progress");
    expect(inProgressOrderNumbers).not.toContain("seg-in-progress-old");
    // 対象外にした注文は処理中セグメントには出ない。
    expect(inProgressOrderNumbers).not.toContain("seg-excluded-in-progress");

    const unprocessedRows = await repository.findSegmentOrders("unprocessed", 200, now);
    const unprocessedOrderNumbers = unprocessedRows.map((o) => o.orderNumber);
    // 一時保存中・対象外の注文は未処理セグメントには出ない。
    expect(unprocessedOrderNumbers).not.toContain("seg-held");
    expect(unprocessedOrderNumbers).not.toContain("seg-excluded-unprocessed");

    const excludedRows = await repository.findSegmentOrders("excluded", 200, now);
    const excludedOrderNumbers = excludedRows.map((o) => o.orderNumber);
    expect(excludedOrderNumbers).toContain("seg-excluded-unprocessed");
    expect(excludedOrderNumbers).toContain("seg-excluded-in-progress");
  });
});

describe("orderRepository.findOrderDirectory", () => {
  let prisma: PrismaClient;
  let repository: ReturnType<typeof createOrderRepository>;

  beforeAll(async () => {
    prisma = await createTestPrismaClient();
    repository = createOrderRepository(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("注文番号・氏名で検索でき、ステータスでも絞り込める", async () => {
    await repository.upsertByChannelAndOrderNumber(
      buildInput({ orderNumber: "dir-0001", ordererName: "検索 一郎", orderStatus: "300" })
    );
    await repository.upsertByChannelAndOrderNumber(
      buildInput({ orderNumber: "dir-0002", ordererName: "検索 次郎", orderStatus: "500" })
    );

    const bySearch = await repository.findOrderDirectory({ search: "検索 一郎" });
    expect(bySearch.orders.map((o) => o.orderNumber)).toEqual(["dir-0001"]);

    const byStatus = await repository.findOrderDirectory({ status: "500" });
    expect(byStatus.orders.map((o) => o.orderNumber)).toContain("dir-0002");
    expect(byStatus.orders.map((o) => o.orderNumber)).not.toContain("dir-0001");
  });

  it("ページ送りができ、totalは絞り込み後の全件数を返す", async () => {
    for (let i = 0; i < 3; i++) {
      await repository.upsertByChannelAndOrderNumber(
        buildInput({ orderNumber: `dir-page-${i}`, orderStatus: "900" })
      );
    }

    const page1 = await repository.findOrderDirectory({ status: "900", page: 1, pageSize: 2 });
    expect(page1.orders).toHaveLength(2);
    expect(page1.total).toBe(3);

    const page2 = await repository.findOrderDirectory({ status: "900", page: 2, pageSize: 2 });
    expect(page2.orders).toHaveLength(1);
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
