import fs from "node:fs/promises";
import path from "node:path";

import type { Review } from "@/generated/prisma/client";

// アプリのDB(dev.db)とは別に、レビューの全履歴をJSONL(1行1レビューのJSON)として
// ローカルファイルに保持するための入出力層。ここでは「読み書き」のみを担当し、
// 保持期間の判定やDBからの削除はreview-retention.tsの責務とする。

export interface ReviewArchiveConfig {
  archiveFilePath: string;
  retentionMonths: number;
}

export function loadReviewArchiveConfig(env: NodeJS.ProcessEnv = process.env): ReviewArchiveConfig {
  const dir = env.REVIEW_ARCHIVE_DIR?.trim() || "data/review-archive";
  const retentionMonths = Number(env.REVIEW_RETENTION_MONTHS ?? 6);

  return {
    archiveFilePath: path.isAbsolute(dir)
      ? path.join(dir, "reviews.jsonl")
      : path.join(process.cwd(), dir, "reviews.jsonl"),
    retentionMonths: Number.isFinite(retentionMonths) && retentionMonths > 0 ? retentionMonths : 6,
  };
}

export function archiveKey(channel: string, sourceUrl: string): string {
  return `${channel}|${sourceUrl}`;
}

interface ReviewArchiveRecord {
  id: string;
  channel: string;
  reviewType: string;
  sourceUrl: string;
  productName: string | null;
  title: string | null;
  body: string;
  rating: number;
  orderNumber: string | null;
  reviewedAt: string;
  rawPayload: string;
  replyStatus: string;
  replyText: string | null;
  replyGeneratedAt: string | null;
  repliedAt: string | null;
  replyError: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string;
}

function toArchiveRecord(review: Review): ReviewArchiveRecord {
  return {
    id: review.id,
    channel: review.channel,
    reviewType: review.reviewType,
    sourceUrl: review.sourceUrl,
    productName: review.productName,
    title: review.title,
    body: review.body,
    rating: review.rating,
    orderNumber: review.orderNumber,
    reviewedAt: review.reviewedAt.toISOString(),
    rawPayload: review.rawPayload,
    replyStatus: review.replyStatus,
    replyText: review.replyText,
    replyGeneratedAt: review.replyGeneratedAt?.toISOString() ?? null,
    repliedAt: review.repliedAt?.toISOString() ?? null,
    replyError: review.replyError,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
    archivedAt: new Date().toISOString(),
  };
}

// アーカイブファイルに既に存在するレビューのキー集合を返す(重複追記を避けるため)。
// ファイルが存在しない場合は空集合を返す。
export async function loadArchivedKeys(archiveFilePath: string): Promise<Set<string>> {
  const keys = new Set<string>();

  let content: string;
  try {
    content = await fs.readFile(archiveFilePath, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return keys;
    throw error;
  }

  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    try {
      const record = JSON.parse(line) as { channel: string; sourceUrl: string };
      keys.add(archiveKey(record.channel, record.sourceUrl));
    } catch {
      // 手動編集等による破損行はスキップする(アーカイブ全体を失敗させない)。
    }
  }

  return keys;
}

// レビューをJSONL形式でアーカイブファイルに追記する(既存内容は変更しない)。
export async function appendReviewsToArchive(archiveFilePath: string, reviews: Review[]): Promise<void> {
  if (reviews.length === 0) return;

  await fs.mkdir(path.dirname(archiveFilePath), { recursive: true });
  const lines = reviews.map((review) => JSON.stringify(toArchiveRecord(review))).join("\n") + "\n";
  await fs.appendFile(archiveFilePath, lines, "utf-8");
}
