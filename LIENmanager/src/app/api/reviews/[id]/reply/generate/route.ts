import { NextResponse } from "next/server";

import { reviewService } from "@/server/review/review.service";

// AIで返信文を生成し、下書きとして保存する(1件・手動トリガー)。
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const review = await reviewService.generateReply(id);
    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }
    return NextResponse.json({ review });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "返信文の生成に失敗しました" },
      { status: 502 }
    );
  }
}
