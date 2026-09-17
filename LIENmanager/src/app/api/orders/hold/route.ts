import { NextResponse } from "next/server";
import { z } from "zod";

import { orderService } from "@/server/order/order.service";

const PostBodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
  held: z.boolean(),
});

// 複数選択時の一括「一時保存にする」/「未処理へ戻す」。
export async function POST(request: Request) {
  const parsed = PostBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "ids(1件以上)とheldが必要です" }, { status: 400 });
  }

  const result = await orderService.setHeldMany(parsed.data.ids, parsed.data.held);
  return NextResponse.json(result);
}
