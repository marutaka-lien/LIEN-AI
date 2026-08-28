import type { Locator, Page } from "playwright";

// レビューチェックツール(review.rms.rakuten.co.jp/search/index/)関連のセレクタ。
// 2026-08-06 実画面調査(Claude in Chrome)で「CSVダウンロード」というテキストリンクの
// 存在自体は確認済みだが、rms/selectors配下の他ファイルと異なり正確な
// アクセシブルネーム・DOM構造までは未検証。初回の実行(CSV_DOWNLOADステップ)が
// 失敗する場合はここを実画面で確認して調整すること。
export const reviewToolSelectors = {
  csvDownloadLink: (page: Page) => page.getByRole("link", { name: "CSVダウンロード" }),
};

// レビュー詳細ページ(Review.sourceUrl)の返信フォーム関連セレクタ。
// 【未検証】2026-08-06時点でレビューチェックツールに実際の「返信」フォームが
// 存在するか、DOM構造・アクセシブルネームともに未確認(csvDownloadLinkと異なり
// 実画面調査を行っていない)。以下は想定に基づく仮実装であり、rms-review-reply-
// browser-client.tsをexecute:trueで初めて動かす前に、必ずClaude in Chrome等で
// 実画面を確認し、下記セレクタを実際のDOM構造に合わせて修正すること。
export const reviewReplySelectors = {
  replyTextarea: (page: Page) => page.getByRole("textbox", { name: "返信" }),
  submitButton: (page: Page) => page.getByRole("button", { name: "投稿する" }),
  postedConfirmation: (page: Page) => page.getByText("返信を投稿しました"),
};

// 楽天の公開レビューページ(review.rakuten.co.jp、review.rms.rakuten.co.jpとは別ドメイン。
// ログイン不要・R-Loginセッション不要)の「ショップからのコメント」ブロック関連セレクタ。
// 2026-08-26 実画面調査(このタスクでPlaywright実際に実行して確認済み。/item/および
// /shop/ の両URL形式で同一構造を確認)。
//
// 実際のDOM(抜粋、値は例):
//   <div class="shop-comment--179vx shop-comment-no-widget--32XBl">
//     <div class="comment-header--3djaj">
//       <div class="comment-header-text--25hY1">…アイコン…<div class="text-display--…">ショップからのコメント</div></div>
//       <div class="text-display--…">2026/08/20</div>  ← 返信日(YYYY/MM/DD、時刻なし)
//     </div>
//     <div class="…"><div class="shop-comment-body--3WU17">(返信本文)</div></div>
//   </div>
// 未返信のレビューページではこのブロック自体がDOMに存在しない(見出しテキストも
// 出現しない)ことを確認済み。
//
// class名の末尾(--179vx等)はCSS Modulesのハッシュ付きサフィックスで、Rakuten側の
// デプロイにより変わり得る。ハッシュを含めず「shop-comment--」を部分一致
// (contains)させることで、サフィックスの変化に耐えるようにしている。
export const publicReviewPageSelectors = {
  // 部分一致(*=)。"shop-comment-no-widget--…"のような類似クラス名を誤って
  // 拾わないよう、ダッシュ2つ(shop-comment--)まで含めて一致させる。
  shopCommentContainer: (page: Page) => page.locator('[class*="shop-comment--"]'),
  shopCommentHeadingText: "ショップからのコメント",
  commentHeader: (root: Locator) => root.locator('[class*="comment-header--"]'),
  commentBody: (root: Locator) => root.locator('[class*="shop-comment-body--"]'),
};
