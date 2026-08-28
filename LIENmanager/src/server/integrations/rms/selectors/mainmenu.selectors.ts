import type { Page } from "playwright";

// RMSメインメニュー(https://mainmenu.rms.rakuten.co.jp/rms)関連のセレクタ。
// 2026-07-22 実画面で確認済み。
export const mainMenuSelectors = {
  // 未ログイン/セッション切れ時にのみ表示される再ログイン誘導見出し。
  // 実データ確認: ブラウザを閉じるとこの画面に戻される事象を確認済み。
  reloginRequiredHeading: (page: Page) =>
    page.getByText("再度ログインをお願いいたします", { exact: true }),

  // ログイン済みダッシュボードの左サイドバーに存在するメニュー項目。
  orderPaymentManagementMenuItem: (page: Page) =>
    page.getByText("受注・決済管理", { exact: true }),
};
