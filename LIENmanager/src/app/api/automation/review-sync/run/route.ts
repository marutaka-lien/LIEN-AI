import { NextResponse } from "next/server";

import { createDefaultRmsReviewSyncOrchestrator } from "@/server/automations/rms-review-sync/orchestrator";

// AutomationJobを作成し、Orchestratorをバックグラウンドで開始する。オプションは無し
// (レビュー同期はCSV取得→パース→upsertのみで、実行有無を切り替える必要がない)。
export async function POST() {
  const orchestrator = createDefaultRmsReviewSyncOrchestrator();
  const jobId = await orchestrator.run();

  return NextResponse.json({ jobId });
}
