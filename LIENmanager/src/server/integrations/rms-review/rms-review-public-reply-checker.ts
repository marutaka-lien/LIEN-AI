import type { Page } from "playwright";

import { publicReviewPageSelectors } from "./rms-review.selectors";

// review.rms.rakuten.co.jp(RMS)配下のレビュー返信フォーム(rms-review-reply-
// browser-client.ts)とは別に、review.rakuten.co.jp(楽天の一般公開レビューページ、
// ログイン不要)を確認する層。
//
// 背景: Review.replyStatusはレビュー初回取り込み時に"unreplied"で固定され、自社アプリが
// 実際にRMS経由で返信投稿に成功しない限り更新されない設計になっている
// (rms-review-mapper.ts / review.repository.ts参照)。そのため、過去に手動でRMS画面から
// 返信済みのレビューも、DB上は"unreplied"のまま残っているケースがある(2026-08-26、
// 経営側がClaude in Chromeで実際に確認)。ここでは、その棚卸し用に公開レビューページの
// 「ショップからのコメント」ブロックの有無で実際の返信状況を判定する。
//
// RMSのPersistent Context(rms-browser-context.ts)は使わない。対象ページはログイン
// 不要な公開ページであり、RMSセッションを共有する理由がないため(むしろ無関係な
// Cookie往来を避けるため独立したPageを使うべき)。Pageの生成・破棄は呼び出し側の責務とする。

export type PublicReplyJudgement = "replied" | "not_replied" | "undetermined";

export interface PublicReplyCheckResult {
  judgement: PublicReplyJudgement;
  // 検出できた場合のみ。返信日はYYYY/MM/DD形式(時刻情報なし)でしか公開ページに
  // 出ないため、JST 00:00時点として解釈しUTCへ変換したものを入れる。
  repliedAt: Date | null;
  repliedDateText: string | null;
  // 返信本文そのものは個人情報方針により保持・出力しない。文字数のみ(疎通確認・
  // 目視サニティチェック用)。
  replyBodyLength: number | null;
  // 本文そのもの。既定では取得しない(null)。呼び出し側がoptions.includeReplyBodyを
  // 明示的にtrueにした場合のみ格納される(2026-08-26、DB反映可否の技術検証タスクで追加)。
  // 呼び出し側は、これをログ・一時ファイル・レポート等へそのまま出力してはならない
  // (個人情報は許可リスト方式。件数・成否レベルでのみ扱うこと)。DB反映する場合も
  // Review.replyText列への直接代入以外の用途に使わないこと。
  replyBodyText: string | null;
  // judgementが"undetermined"の場合の理由(ページ遷移失敗・構造不一致等)。
  reason?: string;
}

export interface CheckPublicReplyStatusOptions {
  // trueの場合のみ、ショップコメント本文の実テキストをreplyBodyTextに格納する。
  // 既定false(個人情報方針に従い、明示的に要求されない限り本文は保持しない)。
  includeReplyBody?: boolean;
}

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

function parseJstDateOnly(value: string): Date | null {
  const match = value.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const utcMs = Date.UTC(year, month - 1, day, 0, 0, 0) - JST_OFFSET_MS;
  return new Date(utcMs);
}

// sourceUrl(楽天公開レビューページ)へ遷移し、「ショップからのコメント」ブロックの
// 有無を判定する。読み取りのみ(フォーム入力・投稿等の操作は一切行わない)。
export async function checkPublicReplyStatus(
  page: Page,
  sourceUrl: string,
  options: CheckPublicReplyStatusOptions = {}
): Promise<PublicReplyCheckResult> {
  const empty = {
    repliedAt: null,
    repliedDateText: null,
    replyBodyLength: null,
    replyBodyText: null,
  } as const;

  let response;
  try {
    response = await page.goto(sourceUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  } catch (error) {
    return {
      judgement: "undetermined",
      ...empty,
      reason: `ページ遷移に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  if (response && !response.ok()) {
    return {
      judgement: "undetermined",
      ...empty,
      reason: `HTTPステータス異常: ${response.status()}`,
    };
  }

  const container = publicReviewPageSelectors.shopCommentContainer(page);
  const containerCount = await container.count();
  if (containerCount === 0) {
    return { judgement: "not_replied", ...empty };
  }

  const first = container.first();
  const headingCount = await first
    .getByText(publicReviewPageSelectors.shopCommentHeadingText)
    .count();
  if (headingCount === 0) {
    // "shop-comment--"に部分一致する要素はあったが見出しテキストが確認できない。
    // Rakuten側のDOM構造変更の可能性があるため、安全側に倒して未確認とする
    // (誤って"replied"と判定してはならない)。
    return {
      judgement: "undetermined",
      ...empty,
      reason: "shop-comment--要素は見つかったが見出しテキストを確認できませんでした(DOM構造変更の可能性)",
    };
  }

  let repliedDateText: string | null = null;
  let repliedAt: Date | null = null;
  try {
    const headerText = await publicReviewPageSelectors.commentHeader(first).first().innerText();
    const match = headerText.match(/\d{4}\/\d{1,2}\/\d{1,2}/);
    if (match) {
      repliedDateText = match[0];
      repliedAt = parseJstDateOnly(match[0]);
    }
  } catch {
    // 日付抽出の失敗は判定(replied)には影響させない。補助情報が取れないだけ。
  }

  let replyBodyLength: number | null = null;
  let replyBodyText: string | null = null;
  try {
    const bodyText = await publicReviewPageSelectors.commentBody(first).first().innerText();
    replyBodyLength = bodyText.length;
    if (options.includeReplyBody) {
      replyBodyText = bodyText;
    }
  } catch {
    // 同上。取得できなくても判定には影響しない。
  }

  return { judgement: "replied", repliedAt, repliedDateText, replyBodyLength, replyBodyText };
}
