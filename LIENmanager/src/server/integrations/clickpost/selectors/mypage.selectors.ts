import type { Page } from "playwright";

// マイページ(https://clickpost.jp/mypage/index)関連のセレクタ。
// 2026-07-23 実画面で確認済み。
export const mypageSelectors = {
  // ログイン済みの場合のみ表示される完全一致テキスト。
  logoutLink: (page: Page) => page.getByText("ログアウト", { exact: true }),

  // マイページから「まとめ申込」へはリンクテキストのクリックでのみ遷移できる。
  // /labels/multiple_upload への直接URLナビゲーションは/mypage/indexへ
  // リダイレクトされることを実画面で確認済み(推測ではなく実測結果)。
  bulkApplicationLink: (page: Page) => page.getByText("まとめ申込").first(),
};

// 発送履歴テーブルの列構成(実画面で確認済み、2026-07-27):
// 0:申込日時 / 1:お問い合わせ番号(追跡番号、12桁数字) / 2:お届け先氏名 / 3:内容品 /
// 4:ラベル印字 / 5:配達情報 / 6:利用控 / 7:決済
// (page.evaluate内でDOMを直接操作するため、Playwright Locatorとしては定義していない)
