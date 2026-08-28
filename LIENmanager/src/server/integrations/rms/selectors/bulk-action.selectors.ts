import type { Page } from "playwright";

// 「一括処理」展開後に表示されるアクションボタン群。2026-07-22 実DOMで確認済み。
export const bulkActionSelectors = {
  // 実DOM確認済み(2026-07-28、「処理中」一覧画面=RMS_ORDER_LIST_PENDING_CONFIRMATION_URLでのみ
  // 存在することを確認。注文検索画面には存在しない):
  // <button id="rms-content-order-filter-final-order-btn"
  //   class="btn btn-width-lg pink pull-right" type="button">注文確認</button>
  confirmOrderButton: (page: Page) =>
    page.locator("#rms-content-order-filter-final-order-btn"),

  // 上記ボタンをクリックすると表示される確認モーダルの最終確定ボタン。
  // 実DOM確認済み(2026-07-28): <button id="orderConfirm"
  //   class="btn btn-primary rms-modal-button-confirm ...">注文確認</button>
  // これをクリックしないと注文確認は完了しない。
  confirmOrderModalButton: (page: Page) => page.locator("#orderConfirm"),
};
