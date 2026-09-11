// 「一時保存にする」/「未処理へ戻す」「一時保存から外す」のAPI呼び出し。
// heldAt以外は一切変更しない(サーバー側 order.repository.setHeld/setHeldMany と対応)。

export async function setOrderHeld(id: string, held: boolean): Promise<boolean> {
  const res = await fetch(`/api/orders/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ held }),
  });
  return res.ok;
}

export async function setOrdersHeldMany(ids: string[], held: boolean): Promise<boolean> {
  if (ids.length === 0) return true;
  const res = await fetch("/api/orders/hold", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, held }),
  });
  return res.ok;
}
