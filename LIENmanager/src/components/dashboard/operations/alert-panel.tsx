import { ArrowRight, CircleCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";

import type { OperationAlert } from "@/lib/operations-dashboard";

/**
 * 要確認事項。0件なら落ち着いた1行、あれば件数つきの警告リストを出す。
 */
export function AlertPanel({ alerts, checkedAt }: { alerts: OperationAlert[]; checkedAt: string }) {
  if (alerts.length === 0) {
    return (
      <section
        className="glass lg-rise flex items-center gap-3 rounded-2xl px-5 py-3.5"
        style={{ "--delay": "80ms" } as React.CSSProperties}
      >
        <span className="lg-pop flex size-8 items-center justify-center rounded-full bg-success-subtle">
          <CircleCheck className="size-4 text-success-foreground" aria-hidden />
        </span>
        <p className="text-sm">
          確認事項なし
          <span className="ml-2 text-xs tabular-nums text-text-secondary">{checkedAt} 時点</span>
        </p>
      </section>
    );
  }

  const total = alerts.reduce((acc, alert) => acc + alert.count, 0);

  return (
    <section
      className="glass lg-rise rounded-2xl px-5 py-4"
      style={{ "--delay": "80ms" } as React.CSSProperties}
      role="alert"
    >
      <p className="mb-2 flex items-center gap-2.5 text-sm font-semibold">
        <span className="lg-pop flex size-8 items-center justify-center rounded-full bg-warning-subtle">
          <TriangleAlert className="size-4 text-warning-foreground" aria-hidden />
        </span>
        要確認 <span className="tabular-nums text-warning-foreground">{total}件</span>
      </p>
      <ul className="flex flex-col">
        {alerts.map((alert) => (
          <li
            key={alert.key}
            className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-t border-border-subtle py-2.5 text-sm first:border-t-0"
          >
            <span>{alert.label}</span>
            <span className="text-right font-semibold tabular-nums">{alert.count}件</span>
            <Link
              href={alert.href}
              className="inline-flex min-h-9 items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              確認する
              <ArrowRight className="size-3" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
