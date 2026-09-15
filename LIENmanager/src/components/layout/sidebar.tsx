"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, MessageSquare, Workflow, Package, Shirt, Sparkles } from "lucide-react";

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
    href: "/products",
    label: "商品管理",
    icon: Shirt,
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
    <>
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground backdrop-blur-xl md:flex">
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="relative flex size-10 items-center justify-center rounded-xl border border-primary-border bg-primary-subtle text-primary shadow-[0_0_28px_rgba(189,125,116,0.18)]">
          <Package className="size-5" />
          <Sparkles className="absolute -right-1 -top-1 size-3.5" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-wide">LIEN Manager</span>
          <span className="text-[0.6rem] font-mono tracking-[0.22em] text-primary/80">
            COMMERCE OPERATIONS
          </span>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1.5 px-3 py-3" aria-label="メインナビゲーション">
        <p className="px-3 pb-2 text-[0.62rem] font-semibold tracking-[0.18em] text-muted-foreground/70">WORKSPACE</p>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-200",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                isActive && "bg-primary-subtle text-foreground shadow-[inset_0_0_0_1px_rgba(189,125,116,0.18)]"
              )}
            >
              <Icon
                className={cn(
                  "size-[1.1rem] text-muted-foreground transition-colors group-hover:text-foreground",
                  isActive && "text-primary"
                )}
              />
              {item.label}
              {isActive && (
                <span className="absolute left-0 h-5 w-0.5 rounded-r-full bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mx-3 mb-3 flex items-center gap-3 rounded-xl border border-sidebar-border bg-surface/50 px-3 py-3">
        <span
          className={cn(
            "size-2 rounded-full",
            runningJobCount > 0 ? "bg-primary shadow-[0_0_10px_currentColor]" : "bg-success-foreground"
          )}
        />
        <span className="text-[0.7rem] text-muted-foreground">
          {runningJobCount > 0 ? `自動化を実行中 · ${runningJobCount}件` : "システム正常 · 待機中"}
        </span>
      </div>

      <div className="border-t border-sidebar-border px-5 py-4 text-[0.7rem] text-muted-foreground">
        <div className="flex items-center justify-between font-mono">
          <span>v0.1.0</span>
          <span className="rounded-full bg-muted px-2 py-0.5">DEV</span>
        </div>
      </div>
    </aside>
    <nav className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-4 rounded-2xl border border-sidebar-border bg-sidebar/95 p-1.5 shadow-2xl backdrop-blur-xl md:hidden" aria-label="モバイルナビゲーション">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return <Link key={item.href} href={item.href} className={cn("flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[0.62rem] font-medium text-muted-foreground", isActive && "bg-primary-subtle text-primary")}><Icon className="size-5"/><span>{item.label.replace("ダッシュボード", "ホーム").replace("発送エントリー", "発送")}</span></Link>;
      })}
    </nav>
    </>
  );
}
