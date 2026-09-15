import { NextResponse } from "next/server";
import { z } from "zod";

import { orderService } from "@/server/order/order.service";

const PatchBodySchema = z.union([
  z.object({ held: z.boolean() }),
  z.object({ excluded: z.boolean() }),
]);

// 1件だけの「一時保存にする」/「未処理へ戻す」・「一時保存から外す」、
// または「対象外にする」/「対象外から戻す」(2026-09-15)。
// 一覧の行アクション用(複数選択時はPOST /api/orders/hold または /api/orders/exclude を使う)。
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const parsed = PatchBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "heldまたはexcludedのboolean必須です" },
      { status: 400 }
    );
  }

  try {
    const order =
      "held" in parsed.data
        ? await orderService.setHeld(id, parsed.data.held)
        : await orderService.setExcluded(id, parsed.data.excluded);
    return NextResponse.json({ order });
  } catch {
    return NextResponse.json({ error: "注文が見つかりません" }, { status: 404 });
  }
}
