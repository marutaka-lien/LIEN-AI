import type { Page } from "playwright";

import { loadRmsBrowserConfig } from "../rms/rms-browser-config";
import { getRmsBrowserContext } from "../rms/rms-browser-context";
import type { RmsReviewConfig } from "./rms-review-config";
import { RmsReviewReplyFormNotFoundError, RmsReviewReplyPostError } from "./rms-review-errors";
import { reviewReplySelectors } from "./rms-review.selectors";

// レビュー詳細ページへの返信投稿のみを担当する層(rms-review-browser-client.tsの
// CSVダウンロードとは別ファイル。責務が異なるため)。
// clickpost-browser-client.tsの「確認まで進めるがexecute:falseなら書き込み操作は
// 行わない」方針を踏襲する。

export interface RmsReviewReplyPostResult {
  // 返信フォーム(テキストエリア)がページ上に見つかったか。
  formFound: boolean;
  // 実際に投稿ボタンを押したか(execute:falseなら常にfalse)。
  posted: boolean;
}

export interface RmsReviewReplyBrowserClient {
  // sourceUrl(レビュー詳細ページ)へ遷移し、返信文を入力する。
  // execute:trueの場合のみ投稿ボタンを押し、完了確認までを行う。
  // execute:falseの場合はテキスト入力とフォームの存在確認のみ行い、投稿はしない
  // (ドライラン)。
  postReply(
    sourceUrl: string,
    replyText: string,
    options: { execute: boolean }
  ): Promise<RmsReviewReplyPostResult>;
}

export interface RmsReviewReplyBrowserClientDeps {
  config: RmsReviewConfig;
  // テスト用にPageを注入可能にする。省略時はRMSと共有のPersistent Contextを起動/再利用する。
  getPage?: () => Promise<Page>;
}

export function createRmsReviewReplyBrowserClient(
  deps: RmsReviewReplyBrowserClientDeps
): RmsReviewReplyBrowserClient {
  const { getPage } = deps;

  async function resolvePage(): Promise<Page> {
    if (getPage) return getPage();

    // review.rms.rakuten.co.jpはRMSと同一R-Login SSOセッションのため、RMS用の
    // Persistent Contextプロファイルをそのまま共有できる(rms-review-browser-client.ts
    // と同じ方針)。
    const context = await getRmsBrowserContext(loadRmsBrowserConfig());
    const pages = context.pages();
    return pages[pages.length - 1] ?? (await context.newPage());
  }

  async function postReply(
    sourceUrl: string,
    replyText: string,
    options: { execute: boolean }
  ): Promise<RmsReviewReplyPostResult> {
    const page = await resolvePage();
    await page.goto(sourceUrl, { waitUntil: "domcontentloaded" });

    const textarea = reviewReplySelectors.replyTextarea(page);
    const formFound = (await textarea.count()) > 0;

    if (!formFound) {
      throw new RmsReviewReplyFormNotFoundError(
        `返信フォームが見つかりませんでした(sourceUrl: ${sourceUrl})。` +
          "rms-review.selectors.tsのreviewReplySelectorsが実画面と一致しているか確認してください。"
      );
    }

    await textarea.fill(replyText);

    if (!options.execute) {
      return { formFound: true, posted: false };
    }

    await reviewReplySelectors.submitButton(page).click();
    await page.waitForTimeout(2000);

    const confirmed = (await reviewReplySelectors.postedConfirmation(page).count()) > 0;
    if (!confirmed) {
      throw new RmsReviewReplyPostError(
        `返信の投稿完了を確認できませんでした(sourceUrl: ${sourceUrl})。` +
          "実際に投稿されたかRMS側の画面で必ず確認してください。"
      );
    }

    return { formFound: true, posted: true };
  }

  return { postReply };
}

// 実運用向けのデフォルトファクトリ。
export function createDefaultRmsReviewReplyBrowserClient(
  config: RmsReviewConfig
): RmsReviewReplyBrowserClient {
  return createRmsReviewReplyBrowserClient({ config });
}
