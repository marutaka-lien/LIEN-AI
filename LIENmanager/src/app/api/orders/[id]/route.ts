import { NextResponse } from "next/server";
import { z } from "zod";

import { orderService } from "@/server/order/order.service";

const PatchBodySchema = z.object({
  held: z.boolean(),
});

// 1件だけの「一時保存にする」/「未処理へ戻す」・「一時保存から外す」。
// 一覧の行アクション用(複数選択時はPOST /api/orders/holdを使う)。
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const parsed = PatchBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "heldはboolean必須です" }, { status: 400 });
  }

  try {
    const order = await orderService.setHeld(id, parsed.data.held);
    return NextResponse.json({ order });
  } catch {
    return NextResponse.json({ error: "注文が見つかりません" }, { status: 404 });
  }
}
