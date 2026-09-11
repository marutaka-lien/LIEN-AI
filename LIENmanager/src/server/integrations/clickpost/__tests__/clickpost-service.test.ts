import { describe, expect, it, vi } from "vitest";

import type { Order } from "@/generated/prisma/client";

import { ClickPostConfigError, ClickPostIntegrationError } from "../clickpost-errors";
import { createClickPostService } from "../clickpost-service";
import type { ClickPostBrowserClient, ClickPostLoginState } from "../clickpost-browser-client";

function buildOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "id-1",
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
    rawPayload: null,
    createdAt: new Date("2026-07-22T00:00:00Z"),
    updatedAt: new Date("2026-07-22T00:00:00Z"),
    ...overrides,
  };
}

function buildFakeBrowserClient(overrides: Partial<ClickPostBrowserClient> = {}): ClickPostBrowserClient {
  return {
    checkLoginState: vi.fn(async (): Promise<ClickPostLoginState> => "logged_in"),
    navigateToBulkApplication: vi.fn(async () => {}),
    uploadCsv: vi.fn(async () => ({ reachedConfirmationScreen: true, hasValidationError: false })),
    proceedToPaymentScreen: vi.fn(async () => ({ reachedPaymentScreen: true, paymentButtonPresent: true })),
    executePayment: vi.fn(async () => {
      throw new Error("not implemented");
    }),
    fetchTrackingNumbers: vi.fn(async (names: string[]) =>
      names.map((name) => ({ recipientName: name, trackingNumber: null }))
    ),
    ...overrides,
  };
}

describe("ClickPostService.dryRunMapOrders", () => {
  it("すべて正常な場合はmappableCountが件数と一致しerrorsは空になる", () => {
    const service = createClickPostService();
    const result = service.dryRunMapOrders([buildOrder(), buildOrder({ orderNumber: "order-2" })]);

    expect(result.totalOrders).toBe(2);
    expect(result.mappableCount).toBe(2);
    expect(result.unmappableCount).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(2);
    expect(result.unrepresentableCharOrders).toHaveLength(0);
  });

  it("マッピングに失敗した注文はerrorsに記録され、他の注文の処理は継続する", () => {
    const service = createClickPostService();
    const result = service.dryRunMapOrders([
      buildOrder({ orderNumber: "ok-1" }),
      buildOrder({ orderNumber: "bad-1", postalCode: null }),
      buildOrder({ orderNumber: "ok-2" }),
    ]);

    expect(result.totalOrders).toBe(3);
    expect(result.mappableCount).toBe(2);
    expect(result.unmappableCount).toBe(1);
    expect(result.errors).toEqual([{ orderNumber: "bad-1", reason: expect.stringContaining("郵便番号") }]);
  });

  it("正規化してもCP932で表現できない文字が残る注文はrowsに含めつつunrepresentableCharOrdersにも記録する", () => {
    const service = createClickPostService();
    const result = service.dryRunMapOrders([
      buildOrder({ orderNumber: "ok-1" }),
      buildOrder({ orderNumber: "emoji-1", recipientName: "山田 太郎\u{1F600}" }),
    ]);

    expect(result.mappableCount).toBe(2);
    expect(result.rows).toHaveLength(2);
    expect(result.unrepresentableCharOrders).toEqual([
      {
        orderNumber: "emoji-1",
        issues: [{ field: "recipientName", chars: [{ char: "\u{1F600}", codePoint: "U+1F600" }] }],
      },
    ]);
  });
});

describe("ClickPostService.registerOrders", () => {
  it("execute:falseの場合はブラウザ操作を一切行わず、reachedPaymentScreen:falseを返す(ドライラン)", async () => {
    const browserClient = buildFakeBrowserClient();
    const service = createClickPostService({ browserClient });

    const result = await service.registerOrders([buildOrder()], { execute: false });

    expect(result).toEqual([{ orderNumber: "333267-20260722-0000000001", reachedPaymentScreen: false }]);
    expect(browserClient.checkLoginState).not.toHaveBeenCalled();
  });

  it("execute:trueかつログイン済みの場合、まとめ申込〜確認〜支払手続き画面まで進める", async () => {
    const browserClient = buildFakeBrowserClient();
    const service = createClickPostService({ browserClient });

    const result = await service.registerOrders([buildOrder()], { execute: true });

    expect(result).toEqual([{ orderNumber: "333267-20260722-0000000001", reachedPaymentScreen: true }]);
    expect(browserClient.navigateToBulkApplication).toHaveBeenCalled();
    expect(browserClient.uploadCsv).toHaveBeenCalled();
    expect(browserClient.proceedToPaymentScreen).toHaveBeenCalled();
  });

  it("execute:trueだが未ログインの場合はClickPostIntegrationErrorを投げる", async () => {
    const browserClient = buildFakeBrowserClient({
      checkLoginState: vi.fn(async (): Promise<ClickPostLoginState> => "needs_login"),
    });
    const service = createClickPostService({ browserClient });

    await expect(service.registerOrders([buildOrder()], { execute: true })).rejects.toBeInstanceOf(
      ClickPostIntegrationError
    );
  });

  it("execute:trueだがbrowserClientが未設定の場合はClickPostConfigErrorを投げる", async () => {
    const service = createClickPostService();
    await expect(service.registerOrders([buildOrder()], { execute: true })).rejects.toBeInstanceOf(
      ClickPostConfigError
    );
  });

  it("確認画面でバリデーションエラーが出た場合はClickPostIntegrationErrorを投げる", async () => {
    const browserClient = buildFakeBrowserClient({
      uploadCsv: vi.fn(async () => ({ reachedConfirmationScreen: true, hasValidationError: true })),
    });
    const service = createClickPostService({ browserClient });

    await expect(service.registerOrders([buildOrder()], { execute: true })).rejects.toBeInstanceOf(
      ClickPostIntegrationError
    );
  });
});

describe("ClickPostService.fetchTrackingNumbers", () => {
  it("お届け先氏名でbrowserClientへ問い合わせ、注文番号と組み合わせて返す", async () => {
    const browserClient = buildFakeBrowserClient({
      fetchTrackingNumbers: vi.fn(async (names: string[]) =>
        names.map((name) => ({ recipientName: name, trackingNumber: "628000000001" }))
      ),
    });
    const service = createClickPostService({ browserClient });

    const result = await service.fetchTrackingNumbers([buildOrder()]);

    expect(result).toEqual([
      {
        orderNumber: "333267-20260722-0000000001",
        recipientName: "山田 太郎",
        trackingNumber: "628000000001",
      },
    ]);
  });
});
