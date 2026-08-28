import { NextResponse } from "next/server";

import { reviewService } from "@/server/review/review.service";

// 現在保存されている返信文をRMSへ投稿する(1件・手動トリガー。execute:true固定)。
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const review = await reviewService.postReply(id);
    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }
    return NextResponse.json({ review });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "返信の投稿に失敗しました" },
      { status: 502 }
    );
  }
}
