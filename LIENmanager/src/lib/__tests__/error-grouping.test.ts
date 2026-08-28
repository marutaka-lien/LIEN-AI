import { describe, expect, it } from "vitest";

import { groupFailedItems } from "../error-grouping";

describe("groupFailedItems", () => {
  it("同一errorMessageの失敗アイテムを1グループに集約し件数を数える", () => {
    const groups = groupFailedItems([
      { id: "1", status: "failed", errorMessage: "ClickPost未実装です" },
      { id: "2", status: "failed", errorMessage: "ClickPost未実装です" },
      { id: "3", status: "failed", errorMessage: "郵便番号が不正です" },
      { id: "4", status: "success", errorMessage: null },
    ]);

    expect(groups).toEqual([
      { errorMessage: "ClickPost未実装です", count: 2, itemIds: ["1", "2"] },
      { errorMessage: "郵便番号が不正です", count: 1, itemIds: ["3"] },
    ]);
  });

  it("failed以外やerrorMessageがnullの項目は無視する", () => {
    const groups = groupFailedItems([
      { id: "1", status: "success", errorMessage: null },
      { id: "2", status: "skipped", errorMessage: null },
      { id: "3", status: "failed", errorMessage: null },
    ]);
    expect(groups).toEqual([]);
  });

  it("入力が空配列の場合は空配列を返す", () => {
    expect(groupFailedItems([])).toEqual([]);
  });

  it("件数の多い順にソートされる", () => {
    const groups = groupFailedItems([
      { id: "1", status: "failed", errorMessage: "A" },
      { id: "2", status: "failed", errorMessage: "B" },
      { id: "3", status: "failed", errorMessage: "B" },
      { id: "4", status: "failed", errorMessage: "B" },
    ]);
    expect(groups[0]).toMatchObject({ errorMessage: "B", count: 3 });
    expect(groups[1]).toMatchObject({ errorMessage: "A", count: 1 });
  });
});
