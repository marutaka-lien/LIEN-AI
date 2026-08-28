import {
  createDefaultReviewReplyGenerator,
  type ReviewReplyGenerator,
} from "@/server/integrations/ai/review-reply-generator";
import {
  createDefaultRmsReviewReplyService,
  type RmsReviewReplyService,
} from "@/server/integrations/rms-review/rms-review-reply-service";
import type { ReviewDTO } from "@/types/review";
import { reviewRepository as defaultReviewRepository, type ReviewListFilters } from "./review.repository";
import { toReviewDTO } from "./review.mapper";

const REVIEW_LIST_LIMIT = 200;
// 巡回エージェント(Claude Codeセッションが定期的にDBを読み書きする方式。
// 2026-08-25、ANTHROPIC_API_KEYを設定しない経営判断に伴い採用)向けの既定件数。
// 1回の巡回で読み込むレビュー本文の量を抑えるため、一覧取得より小さめにしておく。
const UNREPLIED_LIST_DEFAULT_LIMIT = 20;
const UNREPLIED_LIST_MAX_LIMIT = 100;

export interface ReviewServiceDeps {
  // テスト用に差し替え可能(review.repository.test.tsと同じくcreateTestPrismaClient経由の
  // インスタンスを注入する想定)。省略時は本番用シングルトンを使う。
  reviewRepository?: typeof defaultReviewRepository;
  replyGenerator?: ReviewReplyGenerator;
  replyPoster?: RmsReviewReplyService;
}

export function createReviewService(deps: ReviewServiceDeps = {}) {
  const reviewRepository = deps.reviewRepository ?? defaultReviewRepository;

  // ANTHROPIC_API_KEY未設定でも一覧取得(listReviews)は動作させたいため、
  // AI生成クライアント・RMS投稿クライアントはどちらも実際に呼ばれるまで初期化しない
  // (遅延生成。後者はPlaywrightのPersistent Context起動を伴うため特に重要)。
  let replyGenerator = deps.replyGenerator;
  function getReplyGenerator(): ReviewReplyGenerator {
    if (!replyGenerator) replyGenerator = createDefaultReviewReplyGenerator();
    return replyGenerator;
  }

  let replyPoster = deps.replyPoster;
  function getReplyPoster(): RmsReviewReplyService {
    if (!replyPoster) replyPoster = createDefaultRmsReviewReplyService();
    return replyPoster;
  }

  return {
    async listReviews(
      limit = REVIEW_LIST_LIMIT,
      filters: ReviewListFilters = {}
    ): Promise<ReviewDTO[]> {
      const reviews = await reviewRepository.findMany(limit, filters);
      return reviews.map(toReviewDTO);
    },

    // 未返信レビューを本文付き・投稿日時が古い順で取得する。UIの一覧(listReviews)とは別に、
    // 巡回エージェント(下書き生成のために定期的にDBを読み書きするClaude Codeセッション)向けに
    // 用意した経路。RMSへの投稿は行わず、下書き保存(saveReplyDraft)と組み合わせて使う想定。
    async listUnreplied(limit = UNREPLIED_LIST_DEFAULT_LIMIT): Promise<ReviewDTO[]> {
      const safeLimit = Math.min(Math.max(1, limit), UNREPLIED_LIST_MAX_LIMIT);
      const reviews = await reviewRepository.findUnreplied(safeLimit);
      return reviews.map(toReviewDTO);
    },

    // AIで返信文を生成し、下書きとして保存する。生成に失敗した場合もReview行に
    // 失敗理由を記録した上でエラーを再送出する(呼び出し元でエラー表示に使う)。
    async generateReply(id: string): Promise<ReviewDTO | null> {
      const review = await reviewRepository.findById(id);
      if (!review) return null;

      try {
        const replyText = await getReplyGenerator().generateReplyText({
          reviewType: review.reviewType,
          rating: review.rating,
          title: review.title,
          productName: review.productName,
          body: review.body,
        });
        const updated = await reviewRepository.updateReply(id, {
          replyStatus: "draft",
          replyText,
          replyGeneratedAt: new Date(),
          replyError: null,
        });
        return toReviewDTO(updated);
      } catch (error) {
        await reviewRepository.updateReply(id, {
          replyStatus: "failed",
          replyError: error instanceof Error ? error.message : "unknown error",
        });
        throw error;
      }
    },

    // 返信文の手動編集(またはAI生成結果の手直し)を下書きとして保存する。
    async saveReplyDraft(id: string, replyText: string): Promise<ReviewDTO | null> {
      const review = await reviewRepository.findById(id);
      if (!review) return null;

      const updated = await reviewRepository.updateReply(id, {
        replyStatus: "draft",
        replyText,
      });
      return toReviewDTO(updated);
    },

    // 現在保存されている返信文をRMSへ投稿する(手動操作のため、確認済みの内容を
    // 確実に反映する)。失敗した場合もReview行に失敗理由を記録した上でエラーを再送出する。
    //
    // 安全装置: 一括返信ジョブ(rms-review-reply/orchestrator.ts)と同じ
    // RMS_REVIEW_REPLY_EXECUTE環境変数(既定false)で本番投稿を止める。経営承認が
    // 下りるまでは、この画面から実際にRMSへ返信が投稿されることはない
    // (下書き生成・保存はこのガードの対象外で、これまで通り動作する)。
    async postReply(id: string): Promise<ReviewDTO | null> {
      const review = await reviewRepository.findById(id);
      if (!review) return null;

      if (!review.replyText?.trim()) {
        throw new Error("返信文が未入力です。先にAI生成または手入力してください。");
      }

      if (process.env.RMS_REVIEW_REPLY_EXECUTE !== "true") {
        throw new Error(
          "RMSへの返信投稿は現在無効化されています(経営承認後にRMS_REVIEW_REPLY_EXECUTEを有効化してください)。下書きの生成・保存は引き続きご利用いただけます。"
        );
      }

      try {
        await getReplyPoster().postReply(review.sourceUrl, review.replyText, { execute: true });
        const updated = await reviewRepository.updateReply(id, {
          replyStatus: "posted",
          repliedAt: new Date(),
          replyError: null,
        });
        return toReviewDTO(updated);
      } catch (error) {
        await reviewRepository.updateReply(id, {
          replyStatus: "failed",
          replyError: error instanceof Error ? error.message : "unknown error",
        });
        throw error;
      }
    },
  };
}

export const reviewService = createReviewService();
