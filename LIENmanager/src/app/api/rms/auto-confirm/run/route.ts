import { NextResponse } from "next/server";

import { runAutoConfirmSweep } from "@/server/automations/rms-auto-confirm/auto-confirm-sweep";

// スケジューラの定期実行を待たず、今すぐ1回スイープを実行するための手動トリガー。
// 個人情報は返さない(件数・成否・汎用エラーメッセージのみ)。
export async function POST() {
  const result = await runAutoConfirmSweep();
  return NextResponse.json(result);
}
