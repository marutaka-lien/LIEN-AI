import { NextResponse } from "next/server";

import { createDefaultRmsService } from "@/server/integrations/rms/rms-service";

// RMSのログイン状態を確認するための診断用エンドポイント。個人情報は一切扱わない。
export async function GET() {
  try {
    const service = createDefaultRmsService();
    const state = await service.checkRmsLoginState();
    return NextResponse.json({ state });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "unknown error" },
      { status: 500 }
    );
  }
}
