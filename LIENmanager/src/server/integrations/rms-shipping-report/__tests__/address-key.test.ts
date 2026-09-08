import { describe, expect, it } from "vitest";

import {
  buildAddressKey,
  buildOrderAddressKey,
  normalizeAddress,
  normalizeName,
  normalizePostalCode7,
} from "../address-key";
import type { ShippingReportTargetOrder } from "../rms-shipping-report-types";

function buildOrder(overrides: Partial<ShippingReportTargetOrder> = {}): ShippingReportTargetOrder {
  return {
    id: "o1",
    orderNumber: "333267-20260722-0000000001",
    recipientName: "山田 太郎",
    ordererName: "山田 太郎",
    postalCode: "150-0001",
    prefecture: "東京都",
    address1: "渋谷区神宮前1-1-1",
    address2: null,
    orderedAt: new Date("2026-07-22T00:00:00Z"),
    rawPayload: null,
    ...overrides,
  };
}

describe("normalizePostalCode7", () => {
  it("数字以外を除いた7桁だけを受け付ける", () => {
    expect(normalizePostalCode7("150-0001")).toBe("1500001");
    expect(normalizePostalCode7("１５０－０００１")).toBe("1500001");
    expect(normalizePostalCode7("〒150-0001")).toBe("1500001");
  });

  it("7桁でなければ空文字(キー不成立)", () => {
    expect(normalizePostalCode7("150-001")).toBe("");
    expect(normalizePostalCode7("")).toBe("");
    expect(normalizePostalCode7(null)).toBe("");
  });
});

describe("normalizeName / normalizeAddress", () => {
  it("全角/半角・空白の揺れを吸収する", () => {
    expect(normalizeName("山田　太郎")).toBe("山田太郎");
    expect(normalizeName("山田 太郎")).toBe("山田太郎");
    expect(normalizeName("ﾔﾏﾀﾞ ﾀﾛｳ")).toBe(normalizeName("ヤマダタロウ"));
  });

  it("ダッシュ・ハイフン類を半角ハイフンへ統一する", () => {
    expect(normalizeAddress("渋谷区神宮前1−1−1")).toBe("渋谷区神宮前1-1-1");
    expect(normalizeAddress("渋谷区神宮前1‐1‐1")).toBe("渋谷区神宮前1-1-1");
  });
});

describe("buildAddressKey", () => {
  it("郵便番号・氏名・住所が揃えばキーになる", () => {
    const key = buildAddressKey({
      postalCode: "150-0001",
      name: "山田 太郎",
      address: "東京都渋谷区神宮前1-1-1",
    });
    expect(key).toBe("1500001|山田太郎|東京都渋谷区神宮前1-1-1");
  });

  it("表記が違っても正規化後に一致すれば同じキーになる", () => {
    const a = buildAddressKey({
      postalCode: "１５０-０００１",
      name: "山田　太郎",
      address: "東京都渋谷区神宮前１−１−１",
    });
    const b = buildAddressKey({
      postalCode: "150-0001",
      name: "山田 太郎",
      address: "東京都渋谷区神宮前1-1-1",
    });
    expect(a).toBe(b);
  });

  it("3要素のどれかが欠けたら空文字(キー不成立)", () => {
    expect(buildAddressKey({ postalCode: "150-0001", name: "山田太郎", address: "" })).toBe("");
    expect(buildAddressKey({ postalCode: "", name: "山田太郎", address: "東京都" })).toBe("");
  });
});

describe("buildOrderAddressKey", () => {
  it("prefecture+address1+address2 を連結してキーを作る", () => {
    const order = buildOrder({
      prefecture: "東京都",
      address1: "渋谷区神宮前1-1-1",
      address2: "コーポ101",
    });
    expect(buildOrderAddressKey(order)).toBe("1500001|山田太郎|東京都渋谷区神宮前1-1-1コーポ101");
  });

  it("recipientName が無ければ ordererName にフォールバックする", () => {
    const order = buildOrder({ recipientName: null, ordererName: "佐藤 花子" });
    expect(buildOrderAddressKey(order)).toContain("|佐藤花子|");
  });

  it("クリックポスト側の住所1本と一致する", () => {
    const order = buildOrder({
      postalCode: "150-0001",
      recipientName: "山田 太郎",
      prefecture: "東京都",
      address1: "渋谷区神宮前1-1-1",
      address2: null,
    });
    const clickpostKey = buildAddressKey({
      postalCode: "150-0001",
      name: "山田太郎",
      address: "東京都渋谷区神宮前1-1-1",
    });
    expect(buildOrderAddressKey(order)).toBe(clickpostKey);
  });
});
