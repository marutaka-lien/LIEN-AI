import { groupFailedItems, type FailedItemLike } from "@/lib/error-grouping";

export function ErrorGroupSummary({ items }: { items: FailedItemLike[] }) {
  const groups = groupFailedItems(items);

  if (groups.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-error-border bg-error-subtle px-3 py-2">
      {groups.map((group) => (
        <div key={group.errorMessage} className="flex items-start gap-2 text-xs">
          <span className="shrink-0 rounded-full bg-error-foreground/15 px-1.5 font-mono tabular-nums text-error-foreground">
            {group.count}件
          </span>
          <span className="text-error-foreground">{group.errorMessage}</span>
        </div>
      ))}
    </div>
  );
}
