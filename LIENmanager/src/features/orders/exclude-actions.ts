// 「対象外にする」/「対象外から戻す」のAPI呼び出し(2026-09-15)。
// hold-actions.tsと同型。excludedAt以外は一切変更しない
// (サーバー側 order.repository.setExcluded/setExcludedMany と対応)。

export async function setOrderExcluded(id: string, excluded: boolean): Promise<boolean> {
  const res = await fetch(`/api/orders/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ excluded }),
  });
  return res.ok;
}

export async function setOrdersExcludedMany(ids: string[], excluded: boolean): Promise<boolean> {
  if (ids.length === 0) return true;
  const res = await fetch("/api/orders/exclude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, excluded }),
  });
  return res.ok;
}
