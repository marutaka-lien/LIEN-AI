import type { Page } from "playwright";

// 注文検索画面(RMS_ORDER_SEARCH_URL)関連のセレクタ。2026-07-22 実画面で確認済み。
export const orderSearchSelectors = {
  // placeholderの実際の値は実画面で確認済み("123456-20030101-12345678")。
  orderNumberInput: (page: Page) => page.getByPlaceholder("123456-20030101-12345678"),

  // 2026-07-28実画面で判明: getByRole("button", {name:"検索"})はアクセシブルネームが
  // 一致せず失敗する(理由未特定、恐らく空白文字等の差異)。実DOMで確認済みのid
  // (id="rms-content-save-button"、テキストは「検索」)で直接指定する。
  searchButton: (page: Page) => page.locator("#rms-content-save-button"),

  noResultsText: (page: Page) =>
    page.getByText("検索条件を指定して", { exact: false }),

  // 検索結果1行に対応するチェックボックス。idに注文番号が含まれることを実DOMで確認済み。
  resultRowCheckbox: (page: Page, orderNumber: string) =>
    page.locator(`#rms-checkbox-order-column-checkbox-${orderNumber}`),
};
