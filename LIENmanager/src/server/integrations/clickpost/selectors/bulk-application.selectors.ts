import type { Page } from "playwright";

// まとめ申込画面(https://clickpost.jp/labels/multiple_upload)関連のセレクタ。
// 2026-07-23 実画面で確認済み。
export const bulkApplicationSelectors = {
  csvFileInput: (page: Page) => page.locator('input[type="file"]'),

  // 実画面確認: 送信ボタンは<button>ではなく<input type="submit">(value="次へ")。
  nextButton: (page: Page) => page.locator('input[type="submit"]').first(),

  // value="戻る" の<input type="button" id="return_multiple_upload">。
  backButton: (page: Page) => page.locator("#return_multiple_upload"),

  // アップロード後、同一URL(/labels/multiple_upload)のままtitleが
  // 「まとめ申込 内容の確認 ー クリックポスト」に変わることで確認画面到達を判定する。
  confirmationErrorBanner: (page: Page) => page.locator(".flash_error_message"),
};
