// Job History展開時、同一エラー内容の失敗注文をグルーピングして件数表示するための
// クライアント側集約ロジック(API/DTOの変更は行わない、純粋関数)。

export interface FailedItemLike {
  id: string;
  status: string;
  errorMessage: string | null;
}

export interface ErrorGroup {
  errorMessage: string;
  count: number;
  itemIds: string[];
}

export function groupFailedItems(items: FailedItemLike[]): ErrorGroup[] {
  const groups = new Map<string, ErrorGroup>();

  for (const item of items) {
    if (item.status !== "failed" || !item.errorMessage) continue;

    const existing = groups.get(item.errorMessage);
    if (existing) {
      existing.count += 1;
      existing.itemIds.push(item.id);
    } else {
      groups.set(item.errorMessage, {
        errorMessage: item.errorMessage,
        count: 1,
        itemIds: [item.id],
      });
    }
  }

  return [...groups.values()].sort((a, b) => b.count - a.count);
}
