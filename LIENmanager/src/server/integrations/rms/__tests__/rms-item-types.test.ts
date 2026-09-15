import { describe, expect, it } from "vitest";

import { parseItemSearchResponse } from "../rms-item-types";
import { RmsResponseFormatError } from "../rms-errors";

describe("parseItemSearchResponse", () => {
  it("正常なレスポンスをパースする", () => {
    const raw = {
      offset: 0,
      numFound: 1,
      results: [
        {
          item: {
            manageNumber: "1000000151",
            title: "テスト商品",
            variants: {},
          },
        },
      ],
    };

    const result = parseItemSearchResponse(raw);

    expect(result.numFound).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].manageNumber).toBe("1000000151");
    expect(result.skippedCount).toBe(0);
  });

  it("1件だけ形式不正な要素があっても全体を失敗させず読み飛ばす", () => {
    const raw = {
      numFound: 2,
      results: [
        { item: { manageNumber: "1000000151", title: "正常な商品" } },
        { item: { title: "manageNumberが無い不正な商品" } },
      ],
    };

    const result = parseItemSearchResponse(raw);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].manageNumber).toBe("1000000151");
    expect(result.skippedCount).toBe(1);
  });

  it("トップレベルの形式が不正な場合はRmsResponseFormatErrorを投げる", () => {
    expect(() => parseItemSearchResponse("not an object")).toThrow(RmsResponseFormatError);
  });

  it("resultsが無い場合は空配列として扱う", () => {
    const result = parseItemSearchResponse({});

    expect(result.items).toEqual([]);
    expect(result.numFound).toBe(0);
  });
});
