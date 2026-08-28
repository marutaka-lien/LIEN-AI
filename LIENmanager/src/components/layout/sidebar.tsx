"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ListOrdered, MessageSquare, Workflow, Package } from "lucide-react";

import { useRunningJobCount } from "@/features/automation/hooks/useRunningJobCount";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "ダッシュボード",
    icon: LayoutDashboard,
  },
  {
    href: "/automation",
    label: "発送エントリー",
    icon: Workflow,
  },
  {
    href: "/orders",
    label: "注文一覧",
    icon: ListOrdered,
  },
  {
    href: "/reviews",
    label: "レビュー",
    icon: MessageSquare,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const runningJobCount = useRunningJobCount();

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary-subtle text-primary">
          <Package className="size-4" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold">発送管理コンソール</span>
          <span className="text-[0.65rem] font-mono tracking-widest text-muted-foreground">
            SHIPPING OPS
          </span>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
              )}
            >
              <Icon
                className={cn(
                  "size-4 text-muted-foreground transition-colors group-hover:text-foreground",
                  isActive && "text-primary"
                )}
              />
              {item.label}
              {isActive && (
                <span className="ml-auto size-1.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-2 border-t border-sidebar-border px-5 py-3">
        <span
          className={cn(
            "size-1.5 rounded-full",
            runningJobCount > 0 ? "bg-primary" : "bg-muted-foreground/40"
          )}
        />
        <span className="text-[0.7rem] text-muted-foreground">
          {runningJobCount > 0 ? `稼働中のジョブ ${runningJobCount}件` : "待機中"}
        </span>
      </div>

      <div className="border-t border-sidebar-border px-5 py-4 text-[0.7rem] text-muted-foreground">
        <div className="flex items-center justify-between font-mono">
          <span>v0.1.0</span>
          <span className="rounded-full bg-muted px-2 py-0.5">DEV</span>
        </div>
      </div>
    </aside>
  );
}
