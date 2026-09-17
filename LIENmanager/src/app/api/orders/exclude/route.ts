import { NextResponse } from "next/server";
import { z } from "zod";

import { orderService } from "@/server/order/order.service";

const PostBodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
  excluded: z.boolean(),
});

// 複数選択時の一括「対象外にする」/「対象外から戻す」(2026-09-15)。
export async function POST(request: Request) {
  const parsed = PostBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "ids(1件以上)とexcludedが必要です" }, { status: 400 });
  }

  const result = await orderService.setExcludedMany(parsed.data.ids, parsed.data.excluded);
  return NextResponse.json(result);
}
