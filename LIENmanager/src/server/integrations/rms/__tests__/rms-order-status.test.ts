import { describe, expect, it } from "vitest";

import { isOrderAlreadyConfirmed, isOrderConfirmationRequired } from "../rms-order-status";
import { RMS_ORDER_PROGRESS } from "../rms-types";

describe("isOrderConfirmationRequired", () => {
  it("100(注文確認待ち)の場合はtrueを返す", () => {
    expect(isOrderConfirmationRequired(RMS_ORDER_PROGRESS.AWAITING_CONFIRM)).toBe(true);
  });

  it("200以上(確認済み各種ステータス)の場合はfalseを返す", () => {
    expect(isOrderConfirmationRequired(RMS_ORDER_PROGRESS.RAKUTEN_PROCESSING)).toBe(false);
    expect(isOrderConfirmationRequired(RMS_ORDER_PROGRESS.AWAITING_SHIPMENT)).toBe(false);
    expect(isOrderConfirmationRequired(RMS_ORDER_PROGRESS.CANCEL_CONFIRMED)).toBe(false);
  });
});

describe("isOrderAlreadyConfirmed", () => {
  it("100未満(注文確認待ちのみ)はfalseを返す", () => {
    expect(isOrderAlreadyConfirmed(RMS_ORDER_PROGRESS.AWAITING_CONFIRM)).toBe(false);
  });

  it("200以上はtrueを返す(2026-07-22実データ: クレジットカード決済で自動確認された注文=300)", () => {
    expect(isOrderAlreadyConfirmed(RMS_ORDER_PROGRESS.RAKUTEN_PROCESSING)).toBe(true);
    expect(isOrderAlreadyConfirmed(RMS_ORDER_PROGRESS.AWAITING_SHIPMENT)).toBe(true);
  });
});
