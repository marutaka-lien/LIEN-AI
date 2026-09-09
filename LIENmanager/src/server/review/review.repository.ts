import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/server/db/prisma";
import type { ReviewReplyUpdateInput, ReviewUpsertInput } from "@/types/review";

export interface ReviewListFilters {
  reviewType?: string; // "product" | "shop"
  rating?: number; // 指定した評価のみに絞る(1-5)
  sinceDays?: number; // 直近N日以内の投稿のみに絞る
}

// channel + sourceUrl を一意キーとして同期する。同じレビューを何度取得しても
// 重複登録されず、既存行は上書き更新される(order.repository.tsと同じ方針)。
// PrismaClientを注入可能にしているのはテスト用(インメモリDBに差し替えるため)。
export function createReviewRepository(prismaClient: PrismaClient = defaultPrisma) {
  return {
    findById(id: string) {
      return prismaClient.review.findUnique({ where: { id } });
    },

    upsertByChannelAndSourceUrl(input: ReviewUpsertInput) {
      return prismaClient.review.upsert({
        where: {
          channel_sourceUrl: {
            channel: input.channel,
            sourceUrl: input.sourceUrl,
          },
        },
        create: input,
        update: input,
      });
    },

    // レビュー一覧画面用: 投稿日時が新しい順に取得する。
    findMany(limit: number, filters: ReviewListFilters = {}) {
      const where: Prisma.ReviewWhereInput = {};

      if (filters.reviewType) {
        where.reviewType = filters.reviewType;
      }

      if (filters.rating !== undefined) {
        where.rating = filters.rating;
      }

      if (filters.sinceDays !== undefined) {
        const since = new Date(Date.now() - filters.sinceDays * 24 * 60 * 60 * 1000);
        where.reviewedAt = { gte: since };
      }

      return prismaClient.review.findMany({
        where,
        orderBy: { reviewedAt: "desc" },
        take: limit,
      });
    },

    // 返信文自動生成・一括投稿ジョブ用: 未返信のレビューを古い順に取得する
    // (先に届いたレビューから返信する)。
    findUnreplied(limit: number) {
      return prismaClient.review.findMany({
        where: { replyStatus: "unreplied" },
        orderBy: { reviewedAt: "asc" },
        take: limit,
      });
    },

    // ダッシュボード表示用: 未返信レビューの件数だけを返す。
    countUnreplied() {
      return prismaClient.review.count({ where: { replyStatus: "unreplied" } });
    },

    // AI生成・下書き編集・RMS投稿のいずれの結果もこれ1つで反映する。
    updateReply(id: string, input: ReviewReplyUpdateInput) {
      return prismaClient.review.update({
        where: { id },
        data: input,
      });
    },

    // 保持期間(既定6ヶ月)を過ぎたレビューを、アーカイブ処理の対象として取得する。
    findOlderThan(cutoff: Date) {
      return prismaClient.review.findMany({
        where: { reviewedAt: { lt: cutoff } },
        orderBy: { reviewedAt: "asc" },
      });
    },

    // アーカイブファイルへの書き込みが完了した行のみを削除する(呼び出し側の責務)。
    deleteMany(ids: string[]) {
      return prismaClient.review.deleteMany({ where: { id: { in: ids } } });
    },
  };
}

export const reviewRepository = createReviewRepository();
