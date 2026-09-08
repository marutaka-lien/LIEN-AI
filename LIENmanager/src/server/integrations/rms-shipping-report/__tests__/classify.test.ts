import { describe, expect, it } from "vitest";

import { classifyShippingReport, parseOrderedOnFromOrderNumber } from "../classify";
import type {
  ClickPostTrackingRow,
  ShippingReportTargetOrder,
} from "../rms-shipping-report-types";

const SHIPPING_DATE = "2026-09-08";
const NOW = new Date("2026-09-08T02:00:00Z");

function order(overrides: Partial<ShippingReportTargetOrder> = {}): ShippingReportTargetOrder {
  return {
    id: overrides.id ?? "o1",
    orderNumber: overrides.orderNumber ?? "333267-20260901-0000000001",
    recipientName: overrides.recipientName ?? "山田 太郎",
    ordererName: overrides.ordererName ?? "山田 太郎",
    postalCode: overrides.postalCode ?? "150-0001",
    prefecture: overrides.prefecture ?? "東京都",
    address1: overrides.address1 ?? "渋谷区神宮前1-1-1",
    address2: overrides.address2 ?? null,
    orderedAt: overrides.orderedAt ?? new Date("2026-09-01T00:00:00Z"),
    rawPayload: overrides.rawPayload ?? null,
  };
}

function tracking(overrides: Partial<ClickPostTrackingRow> = {}): ClickPostTrackingRow {
  return {
    trackingNumber: overrides.trackingNumber ?? "621234567890",
    postalCode: overrides.postalCode ?? "150-0001",
    recipientName: overrides.recipientName ?? "山田 太郎",
    address: overrides.address ?? "東京都渋谷区神宮前1-1-1",
    sourceRowNumber: overrides.sourceRowNumber ?? 1,
  };
}

describe("parseOrderedOnFromOrderNumber", () => {
  it("楽天注文番号の yyyymmdd を取り出す", () => {
    expect(parseOrderedOnFromOrderNumber("333267-20260722-0000000001")?.toISOString()).toBe(
      "2026-07-22T00:00:00.000Z"
    );
  });
  it("解釈できなければ null", () => {
    expect(parseOrderedOnFromOrderNumber("abc")).toBeNull();
  });
});

describe("classifyShippingReport", () => {
  it("1対1で対応が付く注文は自動マッチしCSV行になる", () => {
    const result = classifyShippingReport({
      orders: [order()],
      trackingRows: [tracking()],
      shippingDate: SHIPPING_DATE,
      now: NOW,
    });
    expect(result.autoMatched).toHaveLength(1);
    expect(result.csvRows).toEqual([
      {
        orderNumber: "333267-20260901-0000000001",
        shippingTrackingNumber: "621234567890",
        deliveryCompany: "1003",
        shippingDate: SHIPPING_DATE,
      },
    ]);
    expect(result.needsReview).toHaveLength(0);
  });

  it("表記が違っても宛先が正規化後に一致すればマッチする", () => {
    const result = classifyShippingReport({
      orders: [order({ address1: "渋谷区神宮前１−１−１", recipientName: "山田　太郎" })],
      trackingRows: [tracking()],
      shippingDate: SHIPPING_DATE,
      now: NOW,
    });
    expect(result.autoMatched).toHaveLength(1);
  });

  it("同一宛先に複数注文があるときは代表1件だけCSVに出し、残りは要確認", () => {
    const result = classifyShippingReport({
      orders: [
        order({ id: "o1", orderNumber: "333267-20260901-0000000001", orderedAt: new Date("2026-09-01T00:00:00Z") }),
        order({ id: "o2", orderNumber: "333267-20260903-0000000002", orderedAt: new Date("2026-09-03T00:00:00Z") }),
      ],
      trackingRows: [tracking()],
      shippingDate: SHIPPING_DATE,
      now: NOW,
    });
    expect(result.autoMatched).toHaveLength(0);
    expect(result.representative).toHaveLength(1);
    // 代表 = 最古(9/1)の注文。
    expect(result.representative[0].orderNumber).toBe("333267-20260901-0000000001");
    expect(result.csvRows).toHaveLength(1);
    expect(result.needsReview).toEqual([
      expect.objectContaining({ orderNumber: "333267-20260903-0000000002", reason: "multiple-in-group" }),
    ]);
  });

  it("pairRepresentative=false なら曖昧なグループは一切CSVに出さない", () => {
    const result = classifyShippingReport({
      orders: [
        order({ id: "o1", orderNumber: "333267-20260901-0000000001" }),
        order({ id: "o2", orderNumber: "333267-20260903-0000000002" }),
      ],
      trackingRows: [tracking()],
      shippingDate: SHIPPING_DATE,
      now: NOW,
      pairRepresentative: false,
    });
    expect(result.csvRows).toHaveLength(0);
    expect(result.representative).toHaveLength(0);
    expect(result.needsReview.length).toBeGreaterThanOrEqual(1);
  });

  it("rawPayload に複数送付先があれば代表を出しつつ要確認にも載せる", () => {
    const result = classifyShippingReport({
      orders: [
        order({
          rawPayload: JSON.stringify({ PackageModelList: [{}, {}] }),
        }),
      ],
      trackingRows: [tracking()],
      shippingDate: SHIPPING_DATE,
      now: NOW,
    });
    expect(result.csvRows).toHaveLength(1);
    expect(result.needsReview).toEqual([
      expect.objectContaining({ reason: "multiple-packages" }),
    ]);
  });

  it("注文日が180日を超える注文はスキップしCSVに出さない", () => {
    const result = classifyShippingReport({
      orders: [order({ orderNumber: "333267-20260101-0000000001", orderedAt: new Date("2026-01-01T00:00:00Z") })],
      trackingRows: [tracking()],
      shippingDate: SHIPPING_DATE,
      now: NOW,
    });
    expect(result.csvRows).toHaveLength(0);
    expect(result.skippedExpired).toHaveLength(1);
  });

  it("対応する追跡番号が無い注文は未マッチ(注文側)", () => {
    const result = classifyShippingReport({
      orders: [order()],
      trackingRows: [tracking({ postalCode: "999-9999", address: "北海道札幌市1-1" })],
      shippingDate: SHIPPING_DATE,
      now: NOW,
    });
    expect(result.unmatchedOrders).toHaveLength(1);
    expect(result.unmatchedTracking).toHaveLength(1);
    expect(result.csvRows).toHaveLength(0);
  });

  it("excludeOrderNumbers で外した注文はどの区分にも出ない", () => {
    const result = classifyShippingReport({
      orders: [order({ orderNumber: "333267-20260901-0000000001" })],
      trackingRows: [tracking()],
      shippingDate: SHIPPING_DATE,
      now: NOW,
      excludeOrderNumbers: ["333267-20260901-0000000001"],
    });
    expect(result.csvRows).toHaveLength(0);
    expect(result.autoMatched).toHaveLength(0);
    expect(result.unmatchedOrders).toHaveLength(0);
    // 追跡番号側は行き場が無くなるので未マッチに出る。
    expect(result.unmatchedTracking).toHaveLength(1);
  });

  it("CSV行は注文番号の昇順で並ぶ", () => {
    const result = classifyShippingReport({
      orders: [
        order({ id: "b", orderNumber: "333267-20260902-0000000002", postalCode: "151-0053", address1: "渋谷区代々木2-2-2", recipientName: "佐藤 花子" }),
        order({ id: "a", orderNumber: "333267-20260901-0000000001" }),
      ],
      trackingRows: [
        tracking({ trackingNumber: "621000000002", postalCode: "151-0053", recipientName: "佐藤 花子", address: "東京都渋谷区代々木2-2-2", sourceRowNumber: 2 }),
        tracking({ trackingNumber: "621000000001", sourceRowNumber: 1 }),
      ],
      shippingDate: SHIPPING_DATE,
      now: NOW,
    });
    expect(result.csvRows.map((r) => r.orderNumber)).toEqual([
      "333267-20260901-0000000001",
      "333267-20260902-0000000002",
    ]);
  });
});
