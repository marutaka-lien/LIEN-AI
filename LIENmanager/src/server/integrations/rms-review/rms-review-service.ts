import fs from "node:fs";

import type { ReviewUpsertInput } from "@/types/review";
import {
  createDefaultRmsReviewBrowserClient,
  type RmsReviewBrowserClient,
} from "./rms-review-browser-client";
import { loadRmsReviewConfig } from "./rms-review-config";
import { readReviewsCsvFile } from "./rms-review-csv";
import { toReviewUpsertInput } from "./rms-review-mapper";

export interface RmsReviewFetchResult {
  reviews: ReviewUpsertInput[];
  totalRows: number;
  errors: Array<{ sourceUrl: string | null; reason: string }>;
}

export interface RmsReviewService {
  // CSVダウンロード→パース→変換までを行う。DBへのupsertはOrchestrator側の責務。
  fetchReviews(): Promise<RmsReviewFetchResult>;
}

export interface RmsReviewServiceDeps {
  browserClient: RmsReviewBrowserClient;
}

export function createRmsReviewService(deps: RmsReviewServiceDeps): RmsReviewService {
  const { browserClient } = deps;

  async function fetchReviews(): Promise<RmsReviewFetchResult> {
    const csvPath = await browserClient.downloadReviewsCsv();

    try {
      const rows = readReviewsCsvFile(csvPath);
      const reviews: ReviewUpsertInput[] = [];
      const errors: Array<{ sourceUrl: string | null; reason: string }> = [];

      for (const row of rows) {
        try {
          reviews.push(toReviewUpsertInput(row));
        } catch (error) {
          errors.push({
            sourceUrl: row.sourceUrl || null,
            reason: error instanceof Error ? error.message : "unknown error",
          });
        }
      }

      return { reviews, totalRows: rows.length, errors };
    } finally {
      if (fs.existsSync(csvPath)) fs.unlinkSync(csvPath);
    }
  }

  return { fetchReviews };
}

// 実運用向けのデフォルトファクトリ。
export function createDefaultRmsReviewService(): RmsReviewService {
  const config = loadRmsReviewConfig();
  const browserClient = createDefaultRmsReviewBrowserClient(config);
  return createRmsReviewService({ browserClient });
}
