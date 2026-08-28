import { z } from "zod";

import { RmsReviewConfigError } from "./rms-review-errors";

// review.rms.rakuten.co.jpはRMSと同一R-Login SSOセッションを共有するため、
// ブラウザプロファイル(RMS_BROWSER_PROFILE_DIR)はrms-browser-config.tsのものを
// そのまま流用する(ここでは持たない)。
const RmsReviewEnvSchema = z.object({
  RMS_REVIEW_TOOL_URL: z.url().default("https://review.rms.rakuten.co.jp/search/index/"),
});

export interface RmsReviewConfig {
  reviewToolUrl: string;
}

export function loadRmsReviewConfig(env: NodeJS.ProcessEnv = process.env): RmsReviewConfig {
  const parsed = RmsReviewEnvSchema.safeParse(env);

  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new RmsReviewConfigError(`RMSレビュー設定が不足または不正です: ${missing}`);
  }

  return { reviewToolUrl: parsed.data.RMS_REVIEW_TOOL_URL };
}
