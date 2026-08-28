import type { Page } from "playwright";

// まとめ申込 支払手続き画面(https://clickpost.jp/labels/multiple_payment)関連のセレクタ。
// 2026-07-23 実画面で確認済み。
export const paymentSelectors = {
  // Yahoo!ウォレット決済ボタン。<input type="submit" class="button amazon-ui-button ywallet_button">。
  // このクライアントではクリックしない(決済実行は未実装)。
  payButton: (page: Page) => page.locator('input.ywallet_button[type="submit"]').first(),
};
