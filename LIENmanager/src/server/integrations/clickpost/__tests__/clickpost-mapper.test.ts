import { describe, expect, it } from "vitest";

import type { Order } from "@/generated/prisma/client";

import { ClickPostMappingError } from "../clickpost-errors";
import { ClickPostMapper } from "../clickpost-mapper";

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

describe("ClickPostMapper.toCsvRow", () => {
  it("正常なOrderをClickPostCsvRowへ変換する", () => {
    const row = ClickPostMapper.toCsvRow(buildOrder());

    expect(row.postalCode).toBe("1500001");
    expect(row.recipientName).toBe("山田 太郎");
    expect(row.honorific).toBe("様");
    expect(row.addressLine1).toBe("東京都渋谷区神宮前1-1-1");
    expect(row.addressLine2).toBe("");
    expect(row.contents).toBe("衣料品");
  });

  it("recipientNameが無い場合はordererNameにフォールバックする", () => {
    const row = ClickPostMapper.toCsvRow(buildOrder({ recipientName: null }));
    expect(row.recipientName).toBe("山田 太郎");
  });

  it("お届け先氏名内のダッシュ類(EN DASH等)を半角ハイフンへ正規化する", () => {
    const row = ClickPostMapper.toCsvRow(
      buildOrder({ recipientName: `山田${String.fromCodePoint(0x2212)}太郎` })
    );
    expect(row.recipientName).toBe("山田-太郎");
  });

  it("住所内のダッシュ類(EN DASH等)を半角ハイフンへ正規化する", () => {
    const row = ClickPostMapper.toCsvRow(
      buildOrder({
        prefecture: "東京都",
        address1: `渋谷区神宮前1${String.fromCodePoint(0x2013)}2${String.fromCodePoint(0x2014)}3`,
        address2: null,
      })
    );
    expect(row.addressLine1).toBe("東京都渋谷区神宮前1-2-3");
  });

  it("郵便番号が無い場合はClickPostMappingErrorを投げる", () => {
    expect(() => ClickPostMapper.toCsvRow(buildOrder({ postalCode: null }))).toThrow(
      ClickPostMappingError
    );
  });

  it("郵便番号が7桁でない場合はClickPostMappingErrorを投げる", () => {
    expect(() => ClickPostMapper.toCsvRow(buildOrder({ postalCode: "123" }))).toThrow(
      ClickPostMappingError
    );
  });

  it("住所が長い場合は20文字ごとに複数行へ分割する", () => {
    const row = ClickPostMapper.toCsvRow(
      buildOrder({
        prefecture: "北海道",
        address1: "札幌市北区北七条西1丁目1番地1号サンプルマンション101号室",
        address2: null,
      })
    );

    expect(row.addressLine1).toHaveLength(20);
    expect(row.addressLine2.length).toBeGreaterThan(0);
  });

  it("住所が4行(80文字)を超える場合はClickPostMappingErrorを投げる", () => {
    const veryLongAddress = "あ".repeat(90);
    expect(() =>
      ClickPostMapper.toCsvRow(buildOrder({ prefecture: null, address1: veryLongAddress }))
    ).toThrow(ClickPostMappingError);
  });

  it("住所が全く取得できない場合はClickPostMappingErrorを投げる", () => {
    expect(() =>
      ClickPostMapper.toCsvRow(buildOrder({ prefecture: null, address1: null, address2: null }))
    ).toThrow(ClickPostMappingError);
  });

  it("内容品はrawPayloadの内容に関わらず常に固定文言「衣料品」を使う(業務都合による簡略化)", () => {
    const rawPayload = JSON.stringify({
      PackageModelList: [
        {
          ItemModelList: [{ itemName: "Tシャツ" }, { itemName: "タオル" }],
        },
      ],
    });

    const row = ClickPostMapper.toCsvRow(buildOrder({ rawPayload }));
    expect(row.contents).toBe("衣料品");
  });

  it("rawPayloadがnullや不正なJSONでも内容品は固定文言のまま", () => {
    expect(ClickPostMapper.toCsvRow(buildOrder({ rawPayload: null })).contents).toBe("衣料品");
    expect(ClickPostMapper.toCsvRow(buildOrder({ rawPayload: "{not-json" })).contents).toBe(
      "衣料品"
    );
  });
});
