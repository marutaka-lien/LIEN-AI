import { NextResponse } from "next/server";

import { createDefaultRmsClickPostOrchestrator } from "@/server/automations/rms-clickpost/orchestrator";
import type { RunRakutenClickPostOptions } from "@/server/automations/rms-clickpost/types";

// AutomationJobを作成し、Orchestratorをバックグラウンドで開始する。
// 安全のため、rmsConfirmExecute/clickPostExecuteは明示的にtrueを指定しない限りfalse
// (実際のRMS注文確認クリック・ClickPost実登録は行われず、ドライラン相当の記録のみ行う)。
export async function POST(request: Request) {
  let body: RunRakutenClickPostOptions = {};
  try {
    const raw = await request.json();
    body = {
      rmsConfirmExecute: raw?.rmsConfirmExecute === true,
      clickPostExecute: raw?.clickPostExecute === true,
      orderNumbers: Array.isArray(raw?.orderNumbers)
        ? raw.orderNumbers.filter((value: unknown): value is string => typeof value === "string")
        : undefined,
    };
  } catch {
    // ボディなし(既定値=すべてfalse、orderNumbers未指定=全件)は許容する。
  }

  const orchestrator = createDefaultRmsClickPostOrchestrator();
  const jobId = await orchestrator.run(body);

  return NextResponse.json({ jobId });
}
