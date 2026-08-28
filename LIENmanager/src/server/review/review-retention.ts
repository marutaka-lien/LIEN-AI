import type { Review } from "@/generated/prisma/client";

import {
  appendReviewsToArchive,
  archiveKey,
  loadArchivedKeys,
  loadReviewArchiveConfig,
} from "./review-archive";
import { reviewRepository } from "./review.repository";

// 「アプリのDBには直近N ヶ月分のみを残し、それより古いレビューはアーカイブファイルへ
// 追記してからDBから削除する」という保持ポリシーを実行する。
// レビュー同期(rms-review-sync)ジョブの追加ステップとして毎回呼び出す想定。
//
// 冪等性について: RMSレビューチェックツールのCSVダウンロードには日付範囲の絞り込みが
// なく、再同期のたびに古いレビューが再取得される可能性がある。そのため、DBから削除
// 済みでもCSV経由で行が復活することがある。アーカイブファイルに既に存在するsourceUrl
// は再度書き込まない(archiveKeyで重複チェック)ことで、アーカイブ側の重複を防ぐ。

export interface ReviewRetentionPort {
  findOlderThan(cutoff: Date): Promise<Review[]>;
  deleteMany(ids: string[]): Promise<{ count: number }>;
}

export interface ReviewArchiverPort {
  loadArchivedKeys(archiveFilePath: string): Promise<Set<string>>;
  appendReviewsToArchive(archiveFilePath: string, reviews: Review[]): Promise<void>;
}

export interface ReviewRetentionResult {
  // 保持期間を過ぎ、DBから削除した件数(アーカイブへの新規書き込み有無を問わない)。
  prunedCount: number;
  // うちアーカイブファイルへ新規に書き込んだ件数(既にアーカイブ済みだった分は含まない)。
  archivedCount: number;
}

export interface ReviewRetentionDeps {
  reviewRepository: ReviewRetentionPort;
  archiveFilePath: string;
  retentionMonths: number;
  archiver?: ReviewArchiverPort;
  now?: () => Date;
}

export async function archiveAndPruneOldReviews(
  deps: ReviewRetentionDeps
): Promise<ReviewRetentionResult> {
  const { reviewRepository, archiveFilePath, retentionMonths, now = () => new Date() } = deps;
  const archiver = deps.archiver ?? { loadArchivedKeys, appendReviewsToArchive };

  const cutoff = now();
  cutoff.setMonth(cutoff.getMonth() - retentionMonths);

  const oldReviews = await reviewRepository.findOlderThan(cutoff);
  if (oldReviews.length === 0) {
    return { prunedCount: 0, archivedCount: 0 };
  }

  const archivedKeys = await archiver.loadArchivedKeys(archiveFilePath);
  const needsArchive = oldReviews.filter(
    (review) => !archivedKeys.has(archiveKey(review.channel, review.sourceUrl))
  );

  // 先にアーカイブファイルへの書き込みを完了させてから、DBの行を削除する
  // (書き込みが失敗した場合はここで例外が伝播し、DB削除は行われない=データを失わない)。
  await archiver.appendReviewsToArchive(archiveFilePath, needsArchive);
  await reviewRepository.deleteMany(oldReviews.map((review) => review.id));

  return { prunedCount: oldReviews.length, archivedCount: needsArchive.length };
}

// アプリ実運用向け: 環境変数の設定をそのまま使う。
export function createReviewRetentionRunner(): () => Promise<ReviewRetentionResult> {
  const config = loadReviewArchiveConfig();
  return () =>
    archiveAndPruneOldReviews({
      reviewRepository,
      archiveFilePath: config.archiveFilePath,
      retentionMonths: config.retentionMonths,
    });
}
