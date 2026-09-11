import { describe, expect, it } from "vitest";

import {
  canHoldInSegment,
  formatOrderAddress,
  getSegmentCopy,
  getSegmentEmptyText,
  getSegmentListNote,
  getSegmentMetaHeadLabel,
  getSegmentRowMetaValue,
} from "../shipping-segments";

const baseRow = {
  id: "o1",
  orderNumber: "3782-2026091-0001",
  ordererName: "山田 太郎",
  postalCode: "154-0000",
  prefecture: "東京都",
  address1: "世田谷区",
  address2: "1-2-3",
  orderedAt: "2026-09-10T00:12:00.000Z",
  csvExportedAt: "2026-09-10T02:15:00.000Z",
  shippingReportedAt: "2026-09-10T05:28:00.000Z",
  heldAt: "2026-09-10T01:22:00.000Z",
};

describe("canHoldInSegment", () => {
  it("確認待ち・未処理では一時保存できる", () => {
    expect(canHoldInSegment("awaiting")).toBe(true);
    expect(canHoldInSegment("unprocessed")).toBe(true);
  });

  it("作業中・処理済み・一時保存では一時保存できない", () => {
    expect(canHoldInSegment("inProgress")).toBe(false);
    expect(canHoldInSegment("done")).toBe(false);
    expect(canHoldInSegment("held")).toBe(false);
  });
});

describe("getSegmentRowMetaValue", () => {
  it("未処理/確認待ちは受注時刻を返す", () => {
    expect(getSegmentRowMetaValue("unprocessed", baseRow)).not.toBe("—");
  });

  it("値がnullの場合は—を返す", () => {
    expect(getSegmentRowMetaValue("done", { ...baseRow, shippingReportedAt: null })).toBe("—");
  });

  it("セグメントごとに見る一次ソースが異なる", () => {
    const inProgress = getSegmentRowMetaValue("inProgress", baseRow);
    const held = getSegmentRowMetaValue("held", baseRow);
    // csvExportedAt(02:15)とheldAt(01:22)は異なる時刻なので、同じ文字列にはならない。
    expect(inProgress).not.toBe(held);
  });
});

describe("formatOrderAddress", () => {
  it("都道府県・住所1・住所2を連結する", () => {
    expect(formatOrderAddress(baseRow)).toBe("東京都世田谷区1-2-3");
  });

  it("nullの項目は飛ばして連結する", () => {
    expect(formatOrderAddress({ prefecture: "東京都", address1: null, address2: null })).toBe(
      "東京都"
    );
  });
});

describe("getSegmentCopy / getSegmentListNote / getSegmentEmptyText / getSegmentMetaHeadLabel", () => {
  it("確認待ちは操作不可(actionable:false)", () => {
    expect(getSegmentCopy("awaiting").actionable).toBe(false);
  });

  it("未処理・作業中・処理済み・一時保存は操作可能", () => {
    expect(getSegmentCopy("unprocessed").actionable).toBe(true);
    expect(getSegmentCopy("inProgress").actionable).toBe(true);
    expect(getSegmentCopy("done").actionable).toBe(true);
    expect(getSegmentCopy("held").actionable).toBe(true);
  });

  it("5セグメントすべてに文言が定義されている", () => {
    const segments = ["awaiting", "unprocessed", "inProgress", "done", "held"] as const;
    for (const segment of segments) {
      expect(getSegmentListNote(segment)).toBeTruthy();
      expect(getSegmentEmptyText(segment)).toBeTruthy();
      expect(getSegmentMetaHeadLabel(segment)).toBeTruthy();
    }
  });
});
