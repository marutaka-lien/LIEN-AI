import { describe, expect, it } from "vitest";

import { RmsResponseFormatError } from "../rms-errors";
import { inventoryKey, parseInventoryBulkGetResponse } from "../rms-inventory-types";

describe("inventoryKey", () => {
  it("manageNumberとvariantIdを組み合わせたユニークキーを作る", () => {
    expect(inventoryKey("1000000151", "YP-02black")).toBe("1000000151::YP-02black");
  });
});

describe("parseInventoryBulkGetResponse", () => {
  it("正常なレスポンスをmanageNumber::variantId -> quantityのMapに変換する", () => {
    const raw = {
      inventories: [
        { manageNumber: "1000000151", variantId: "YP-02black", quantity: 6 },
        { manageNumber: "1000000151", variantId: "YP-02beige", quantity: 5 },
      ],
    };

    const map = parseInventoryBulkGetResponse(raw);

    expect(map.get("1000000151::YP-02black")).toBe(6);
    expect(map.get("1000000151::YP-02beige")).toBe(5);
    expect(map.size).toBe(2);
  });

  it("1件だけ形式不正な要素があっても読み飛ばして全体は失敗させない", () => {
    const raw = {
      inventories: [
        { manageNumber: "1000000151", variantId: "YP-02black", quantity: 6 },
        { manageNumber: "1000000151" /* variantId/quantityが無い不正な要素 */ },
      ],
    };

    const map = parseInventoryBulkGetResponse(raw);

    expect(map.size).toBe(1);
    expect(map.get("1000000151::YP-02black")).toBe(6);
  });

  it("トップレベルの形式が不正な場合はRmsResponseFormatErrorを投げる", () => {
    expect(() => parseInventoryBulkGetResponse("not an object")).toThrow(RmsResponseFormatError);
  });

  it("inventoriesが無い場合は空のMapを返す", () => {
    const map = parseInventoryBulkGetResponse({});
    expect(map.size).toBe(0);
  });
});
