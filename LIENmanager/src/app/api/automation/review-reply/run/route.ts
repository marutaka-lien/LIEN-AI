import { NextResponse } from "next/server";

import { createDefaultRmsReviewReplyOrchestrator } from "@/server/automations/rms-review-reply/orchestrator";

// AutomationJobを作成し、未返信レビューへの一括返信(AI生成→RMS_REVIEW_REPLY_EXECUTEが
// trueの場合のみRMS投稿)をバックグラウンドで開始する。
export async function POST() {
  const orchestrator = createDefaultRmsReviewReplyOrchestrator();
  const jobId = await orchestrator.run();

  return NextResponse.json({ jobId });
}
