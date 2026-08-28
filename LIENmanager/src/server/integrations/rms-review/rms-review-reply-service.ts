import {
  createDefaultRmsReviewReplyBrowserClient,
  type RmsReviewReplyBrowserClient,
} from "./rms-review-reply-browser-client";
import { loadRmsReviewConfig } from "./rms-review-config";

export interface RmsReviewReplyResult {
  posted: boolean;
}

export interface RmsReviewReplyService {
  // execute:trueの場合のみ実際にRMSへ投稿する。falseの場合はフォームの存在確認のみ
  // (clickpost-service.tsのregisterOrdersと同じdry run方針)。
  postReply(
    sourceUrl: string,
    replyText: string,
    options: { execute: boolean }
  ): Promise<RmsReviewReplyResult>;
}

export interface RmsReviewReplyServiceDeps {
  browserClient: RmsReviewReplyBrowserClient;
}

export function createRmsReviewReplyService(deps: RmsReviewReplyServiceDeps): RmsReviewReplyService {
  const { browserClient } = deps;

  async function postReply(
    sourceUrl: string,
    replyText: string,
    options: { execute: boolean }
  ): Promise<RmsReviewReplyResult> {
    const result = await browserClient.postReply(sourceUrl, replyText, options);
    return { posted: result.posted };
  }

  return { postReply };
}

// 実運用向けのデフォルトファクトリ。
export function createDefaultRmsReviewReplyService(): RmsReviewReplyService {
  const config = loadRmsReviewConfig();
  const browserClient = createDefaultRmsReviewReplyBrowserClient(config);
  return createRmsReviewReplyService({ browserClient });
}
