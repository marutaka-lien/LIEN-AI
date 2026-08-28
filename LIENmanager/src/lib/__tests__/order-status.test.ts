import { describe, expect, it } from "vitest";

import { getOrderStatusPresentation } from "../order-status";

describe("getOrderStatusPresentation", () => {
  it("300(発送待ち)はisProcessingTarget:trueを返す", () => {
    const result = getOrderStatusPresentation("300");
    expect(result.label).toBe("発送待ち");
    expect(result.isProcessingTarget).toBe(true);
    expect(result.isPendingConfirmation).toBe(false);
  });

  it("100(注文確認待ち)はisPendingConfirmation:trueを返す(処理対象ではない)", () => {
    const result = getOrderStatusPresentation("100");
    expect(result.label).toBe("注文確認待ち");
    expect(result.isProcessingTarget).toBe(false);
    expect(result.isPendingConfirmation).toBe(true);
  });

  it("500(発送済)等はどちらもfalse", () => {
    const result = getOrderStatusPresentation("500");
    expect(result.label).toBe("発送済");
    expect(result.isProcessingTarget).toBe(false);
    expect(result.isPendingConfirmation).toBe(false);
  });

  it("未知の値は「不明(値)」を返す", () => {
    const result = getOrderStatusPresentation("999");
    expect(result.label).toBe("不明(999)");
  });

  it("nullは「不明」を返す", () => {
    const result = getOrderStatusPresentation(null);
    expect(result.label).toBe("不明");
    expect(result.isProcessingTarget).toBe(false);
  });
});
