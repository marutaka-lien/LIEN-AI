import { NextResponse } from "next/server";
import { z } from "zod";

import { reviewService } from "@/server/review/review.service";

const PatchBodySchema = z.object({
  replyText: z.string().min(1),
});

// 返信文の手動編集(下書き保存)。AI生成結果の手直し・ゼロからの手入力どちらにも使う。
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const parsed = PatchBodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "replyTextは必須です" }, { status: 400 });
  }

  const review = await reviewService.saveReplyDraft(id, parsed.data.replyText);
  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  return NextResponse.json({ review });
}
