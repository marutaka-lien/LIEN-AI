import { describe, expect, it } from "vitest";

import { RmsResponseFormatError } from "../rms-errors";
import { parseGetOrderResponse, parseSearchOrderResponse } from "../rms-types";

describe("parseSearchOrderResponse", () => {
  it("正常なレスポンスをパースできる", () => {
    const raw = {
      MessageModelList: [],
      orderNumberList: ["order-1", "order-2"],
      PaginationResponseModel: {
        totalRecordsAmount: 2,
        totalPages: 1,
        requestPage: 1,
      },
    };

    const result = parseSearchOrderResponse(raw);

    expect(result.orderNumberList).toEqual(["order-1", "order-2"]);
    expect(result.PaginationResponseModel?.totalPages).toBe(1);
  });

  it("必須フィールドが欠けている不正なレスポンスはRmsResponseFormatErrorになる", () => {
    const raw = {
      // orderNumberListが文字列配列ではなく数値配列(型不正)
      orderNumberList: [1, 2, 3],
    };

    expect(() => parseSearchOrderResponse(raw)).toThrow(RmsResponseFormatError);
  });

  it("nullや配列そのものが渡された場合もRmsResponseFormatErrorになる", () => {
    expect(() => parseSearchOrderResponse(null)).toThrow(RmsResponseFormatError);
    expect(() => parseSearchOrderResponse([])).toThrow(RmsResponseFormatError);
  });

  it("未知の追加フィールドが含まれていても壊れない(将来のRMS仕様変更への耐性)", () => {
    const raw = {
      orderNumberList: ["order-1"],
      someFutureField: { nested: true },
    };

    const result = parseSearchOrderResponse(raw);

    expect(result.orderNumberList).toEqual(["order-1"]);
  });
});

describe("parseGetOrderResponse", () => {
  it("正常なレスポンスをパースできる", () => {
    const raw = {
      MessageModelList: [],
      OrderModelList: [
        {
          orderNumber: "order-1",
          orderProgress: 300,
          orderDatetime: "2026-01-01T10:00:00+09:00",
          OrdererModel: {
            familyName: "山田",
            firstName: "太郎",
          },
        },
      ],
    };

    const result = parseGetOrderResponse(raw);

    expect(result.OrderModelList).toHaveLength(1);
    expect(result.OrderModelList[0].orderNumber).toBe("order-1");
  });

  it("OrdererModelが欠けている等、構造不正なレスポンスはRmsResponseFormatErrorになる", () => {
    const raw = {
      OrderModelList: [
        {
          orderNumber: "order-1",
          orderProgress: 300,
          orderDatetime: "2026-01-01T10:00:00+09:00",
          // OrdererModelが無い
        },
      ],
    };

    expect(() => parseGetOrderResponse(raw)).toThrow(RmsResponseFormatError);
  });
});
