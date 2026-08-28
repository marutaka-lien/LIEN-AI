import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Review } from "@/generated/prisma/client";

import { appendReviewsToArchive, loadArchivedKeys } from "../review-archive";

function buildReview(overrides: Partial<Review> = {}): Review {
  return {
    id: "review-1",
    channel: "rakuten",
    reviewType: "product",
    sourceUrl: "https://review.rakuten.co.jp/item/1/review-1/",
    productName: "テスト商品",
    title: "とても良い",
    body: "満足しています",
    rating: 5,
    orderNumber: "333267-20260722-0000000001",
    reviewedAt: new Date("2026-01-01T00:00:00Z"),
    rawPayload: "{}",
    replyStatus: "posted",
    replyText: "ありがとうございます",
    replyGeneratedAt: new Date("2026-01-02T00:00:00Z"),
    repliedAt: new Date("2026-01-03T00:00:00Z"),
    replyError: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-03T00:00:00Z"),
    ...overrides,
  };
}

describe("review-archive", () => {
  let tempDir: string;
  let archiveFilePath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "review-archive-test-"));
    archiveFilePath = path.join(tempDir, "reviews.jsonl");
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("ファイルが存在しない場合、loadArchivedKeysは空集合を返す", async () => {
    const keys = await loadArchivedKeys(archiveFilePath);
    expect(keys.size).toBe(0);
  });

  it("appendReviewsToArchiveで書き込んだ内容をloadArchivedKeysで読み取れる", async () => {
    await appendReviewsToArchive(archiveFilePath, [buildReview()]);

    const keys = await loadArchivedKeys(archiveFilePath);
    expect(keys.has("rakuten|https://review.rakuten.co.jp/item/1/review-1/")).toBe(true);
  });

  it("appendReviewsToArchiveを複数回呼ぶと、既存の内容を残したまま追記する", async () => {
    await appendReviewsToArchive(archiveFilePath, [buildReview({ id: "review-1" })]);
    await appendReviewsToArchive(archiveFilePath, [
      buildReview({ id: "review-2", sourceUrl: "https://review.rakuten.co.jp/item/1/review-2/" }),
    ]);

    const content = await fs.readFile(archiveFilePath, "utf-8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(2);

    const keys = await loadArchivedKeys(archiveFilePath);
    expect(keys.size).toBe(2);
  });

  it("空配列を渡した場合はファイルを作成しない", async () => {
    await appendReviewsToArchive(archiveFilePath, []);
    await expect(fs.access(archiveFilePath)).rejects.toThrow();
  });

  it("書き込んだレコードには返信文・返信ステータスも含まれる", async () => {
    await appendReviewsToArchive(archiveFilePath, [buildReview()]);

    const content = await fs.readFile(archiveFilePath, "utf-8");
    const record = JSON.parse(content.trim());
    expect(record.replyStatus).toBe("posted");
    expect(record.replyText).toBe("ありがとうございます");
    expect(record.reviewedAt).toBe("2026-01-01T00:00:00.000Z");
  });
});
