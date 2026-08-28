import type { Page } from "playwright";

// 「処理中」画面(RMS_ORDER_LIST_PENDING_CONFIRMATION_URL等)、
// および注文検索結果画面で共通の一括処理パネル関連のセレクタ。
// 2026-07-22 実画面で確認済み。
export const orderListSelectors = {
  // 「処理中」画面のサブステータスタブ。
  pendingConfirmationTab: (page: Page) => page.getByText("注文確認待ち", { exact: true }),

  // 検索結果/一覧画面いずれにも存在する一括操作の展開ボタン。
  bulkActionMenuButton: (page: Page) => page.getByText("一括処理", { exact: true }),

  noMatchingOrdersText: (page: Page) =>
    page.getByText("指定された条件に該当する注文はありません", { exact: true }),

  // 一覧の各行に対応するチェックボックス。idに注文番号が含まれることを実DOMで確認済み
  // (2026-07-28、「処理中」一覧画面でも同じidパターンで存在することを確認)。
  resultRowCheckbox: (page: Page, orderNumber: string) =>
    page.locator(`#rms-checkbox-order-column-checkbox-${orderNumber}`),
};
