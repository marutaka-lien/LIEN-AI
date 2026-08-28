import { NextResponse } from "next/server";

import { reviewService } from "@/server/review/review.service";

// 未返信レビューを本文付き・投稿日時が古い順で返す。
// 巡回エージェント(下書き生成のために定期的にDBを読み書きするClaude Codeセッション。
// 2026-08-25、ANTHROPIC_API_KEYを設定しない経営判断に伴い採用。/api/reviews/[id]の
// PATCH(下書き保存)と組み合わせて使う)向けの読み取り専用エンドポイント。
// UI一覧(GET /api/reviews)とは別経路とし、UI側の挙動には一切影響しない。
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : undefined;

  const reviews = await reviewService.listUnreplied(
    limit !== undefined && Number.isFinite(limit) ? limit : undefined
  );

  return NextResponse.json({ reviews });
}
