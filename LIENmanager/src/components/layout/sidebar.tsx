"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, MessageSquare, Workflow, Package, Shirt } from "lucide-react";

import { useRunningJobCount } from "@/features/automation/hooks/useRunningJobCount";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "ダッシュボード",
    shortLabel: "ホーム",
    icon: LayoutDashboard,
  },
  {
    href: "/automation",
    label: "発送エントリー",
    shortLabel: "発送",
    icon: Workflow,
  },
  {
    href: "/products",
    label: "商品管理",
    shortLabel: "商品",
    icon: Shirt,
  },
  {
    href: "/reviews",
    label: "レビュー",
    shortLabel: "レビュー",
    icon: MessageSquare,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const runningJobCount = useRunningJobCount();

  return (
    <>
      {/* 幅は w-64 のまま（商品詳細シートの md:left-64 / md:left-[17rem] がこの幅を前提にしている） */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 p-3 md:flex">
        <div className="glass flex w-full flex-col rounded-[1.75rem] px-3 py-4">
          <div className="flex items-center gap-3 px-2 pb-5 pt-1">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-[linear-gradient(150deg,oklch(0.64_0.12_24),oklch(0.5_0.11_18))] text-white shadow-[inset_0_1px_0_oklch(1_0_0/40%),0_8px_20px_-8px_oklch(0.555_0.118_24/70%)]">
              <Package className="size-5" aria-hidden />
            </div>
            <span className="text-[0.95rem] font-semibold tracking-tight">LIEN Manager</span>
          </div>

          <nav className="flex flex-1 flex-col gap-1" aria-label="メインナビゲーション">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "group relative flex min-h-11 items-center gap-3 rounded-2xl px-3 text-sm font-medium text-sidebar-foreground transition-[background-color,color,box-shadow] duration-300 ease-out",
                    "hover:bg-white/60 hover:text-foreground",
                    isActive &&
                      "bg-white text-foreground shadow-[inset_0_1px_0_oklch(1_0_0),0_6px_18px_-8px_oklch(0.235_0.018_262/30%)]"
                  )}
                >
                  <Icon
                    className={cn(
                      "size-[1.15rem] transition-colors group-hover:text-foreground",
                      isActive && "text-primary"
                    )}
                    aria-hidden
                  />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div
            className="flex items-center gap-2.5 rounded-2xl bg-white/50 px-3 py-2.5"
            role="status"
            aria-live="polite"
          >
            <span className="relative flex size-2">
              {runningJobCount > 0 && (
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
              )}
              <span
                className={cn(
                  "relative inline-flex size-2 rounded-full",
                  runningJobCount > 0 ? "bg-primary" : "bg-success-foreground"
                )}
              />
            </span>
            <span className="text-xs text-text-secondary">
              {runningJobCount > 0 ? `自動化を実行中 · ${runningJobCount}件` : "正常に稼働中"}
            </span>
          </div>
        </div>
      </aside>

      <nav
        className="glass fixed inset-x-3 bottom-3 z-50 grid grid-cols-4 gap-1 rounded-[1.6rem] p-1.5 md:hidden"
        aria-label="モバイルナビゲーション"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 rounded-[1.2rem] text-[0.68rem] font-medium text-sidebar-foreground transition-[background-color,color] duration-300",
                isActive && "bg-white text-primary shadow-[0_4px_14px_-6px_oklch(0.235_0.018_262/30%)]"
              )}
            >
              <Icon className="size-5" aria-hidden />
              <span>{item.shortLabel}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
