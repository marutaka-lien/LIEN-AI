import { CircleCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";

import type { OperationAlert } from "@/lib/operations-dashboard";

/**
 * 「要確認事項」パネル。C案モック準拠:
 * 件数つきの警告リスト。0件なら落ち着いた「確認事項なし」を出す。
 */
export function AlertPanel({ alerts, checkedAt }: { alerts: OperationAlert[]; checkedAt: string }) {
  if (alerts.length === 0) {
    return (
      <section className="flex items-center gap-2.5 rounded-xl border border-success-border bg-success-subtle px-4 py-3.5">
        <CircleCheck className="size-4 shrink-0 text-success-foreground" aria-hidden />
        <div>
          <p className="text-sm font-semibold">確認事項なし</p>
          <p className="text-xs text-text-secondary">{checkedAt} 時点で保留・警告はありません。</p>
        </div>
      </section>
    );
  }

  const total = alerts.reduce((acc, alert) => acc + alert.count, 0);

  return (
    <section className="rounded-xl border border-warning-border border-l-[3px] border-l-warning-foreground bg-warning-subtle px-4 py-3.5">
      <h3 className="mb-2.5 flex items-center gap-2 text-sm font-semibold">
        <TriangleAlert className="size-[15px] text-warning-foreground" aria-hidden />
        要確認事項
        <span className="font-mono tabular-nums text-warning-foreground">{total}件</span>
      </h3>
      <ul className="flex flex-col">
        {alerts.map((alert) => (
          <li
            key={alert.key}
            className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-t border-border-subtle py-2.5 text-sm first:border-t-0"
          >
            <span>{alert.label}</span>
            <span className="font-mono tabular-nums text-right">{alert.count}件</span>
            <Link href={alert.href} className="text-xs font-medium text-primary hover:underline">
              確認する →
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
