import { describe, expect, it } from "vitest";

import { RmsOrderMapper } from "../rms-order-mapper";
import type { RmsOrderModel } from "../rms-types";

function buildRmsOrder(overrides: Partial<RmsOrderModel> = {}): RmsOrderModel {
  return {
    orderNumber: "123456-20260101-00000001",
    orderProgress: 300,
    orderDatetime: "2026-01-01T10:00:00+09:00",
    OrdererModel: {
      zipCode1: "150",
      zipCode2: "0001",
      prefecture: "東京都",
      city: "渋谷区神宮前",
      subAddress: "1-1-1",
      familyName: "山田",
      firstName: "太郎",
      emailAddress: "xxxxx@yyy.rakuten.ne.jp",
      phoneNumber1: "0312345678",
    },
    DeliveryModel: {
      deliveryName: "クリックポスト",
    },
    PackageModelList: [],
    ...overrides,
  } as RmsOrderModel;
}

describe("RmsOrderMapper.toOrderUpsertInput", () => {
  it("注文者情報から共通Order型へマッピングする(送付先情報が無い場合)", () => {
    const rmsOrder = buildRmsOrder();

    const result = RmsOrderMapper.toOrderUpsertInput(rmsOrder);

    expect(result.channel).toBe("rakuten");
    expect(result.orderNumber).toBe("123456-20260101-00000001");
    expect(result.ordererName).toBe("山田 太郎");
    expect(result.recipientName).toBe("山田 太郎");
    expect(result.postalCode).toBe("150-0001");
    expect(result.prefecture).toBe("東京都");
    expect(result.address1).toBe("渋谷区神宮前");
    expect(result.address2).toBe("1-1-1");
    expect(result.phoneNumber).toBe("0312345678");
    expect(result.email).toBe("xxxxx@yyy.rakuten.ne.jp");
    expect(result.shippingMethod).toBe("クリックポスト");
    expect(result.orderStatus).toBe("300");
    expect(result.orderedAt).toBeInstanceOf(Date);
    expect(result.rawPayload).toContain("123456-20260101-00000001");
  });

  it("PackageModelListのSenderModelが送付先として優先される", () => {
    const rmsOrder = buildRmsOrder({
      PackageModelList: [
        {
          SenderModel: {
            zipCode1: "530",
            zipCode2: "0001",
            prefecture: "大阪府",
            city: "大阪市北区梅田",
            subAddress: "2-2-2",
            familyName: "鈴木",
            firstName: "花子",
            phoneNumber1: "0698765432",
          },
        },
      ],
    });

    const result = RmsOrderMapper.toOrderUpsertInput(rmsOrder);

    expect(result.recipientName).toBe("鈴木 花子");
    expect(result.postalCode).toBe("530-0001");
    expect(result.prefecture).toBe("大阪府");
    expect(result.address1).toBe("大阪市北区梅田");
    expect(result.address2).toBe("2-2-2");
    expect(result.phoneNumber).toBe("0698765432");
    // 注文者名はOrdererModel由来のまま変わらない
    expect(result.ordererName).toBe("山田 太郎");
  });

  it("日時のパースに失敗してもorderedAtはnullになり例外を投げない", () => {
    const rmsOrder = buildRmsOrder({ orderDatetime: "invalid-date" });

    const result = RmsOrderMapper.toOrderUpsertInput(rmsOrder);

    expect(result.orderedAt).toBeNull();
  });
});
