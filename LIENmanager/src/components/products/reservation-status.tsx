"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  MOCK_SCHEDULE_EVENTS,
  SCHEDULE_MONTH,
  SCHEDULE_TODAY,
  SCHEDULE_YEAR,
  type ScheduleEvent,
  type ScheduleEventKind,
} from "@/lib/mock-schedule";

const WEEKDAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"];
const KIND_FILTERS: ScheduleEventKind[] = ["公開予約", "価格更新", "説明文更新"];

const KIND_STYLES: Record<ScheduleEventKind, { chip: string; cell: string; legendDot: string }> = {
  公開予約: {
    chip: "bg-accent-cyan-subtle text-accent-cyan",
    cell: "bg-accent-cyan-subtle text-accent-cyan",
    legendDot: "bg-accent-cyan",
  },
  価格更新: {
    chip: "bg-primary-subtle text-primary",
    cell: "bg-primary-subtle text-primary",
    legendDot: "bg-primary",
  },
  説明文更新: {
    chip: "bg-warning-subtle text-warning-foreground",
    cell: "bg-warning-subtle text-warning-foreground",
    legendDot: "bg-warning-foreground",
  },
};

type CalendarDay = {
  num: number;
  inMonth: boolean;
  isToday: boolean;
  events: ScheduleEvent[];
};

function buildCalendar(events: ScheduleEvent[]): CalendarDay[] {
  const first = new Date(SCHEDULE_YEAR, SCHEDULE_MONTH - 1, 1);
  const lead = (first.getDay() + 6) % 7;
  const totalDays = new Date(SCHEDULE_YEAR, SCHEDULE_MONTH, 0).getDate();
  const prevMonthTotal = new Date(SCHEDULE_YEAR, SCHEDULE_MONTH - 1, 0).getDate();
  const cellCount = Math.ceil((lead + totalDays) / 7) * 7;

  return Array.from({ length: cellCount }, (_, i) => {
    const n = i - lead + 1;
    const inMonth = n >= 1 && n <= totalDays;
    const num = inMonth ? n : n < 1 ? prevMonthTotal + n : n - totalDays;
    return {
      num,
      inMonth,
      isToday: inMonth && n === SCHEDULE_TODAY,
      events: inMonth ? events.filter((e) => e.day === n) : [],
    };
  });
}

export function ReservationStatus() {
  const [view, setView] = useState<"cal" | "list">("cal");
  const [selectedDay, setSelectedDay] = useState<number | null>(SCHEDULE_TODAY);
  const [filter, setFilter] = useState<ScheduleEventKind | null>(null);
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());

  const events = useMemo(
    () => MOCK_SCHEDULE_EVENTS.map((e) => (confirmed.has(e.key) ? { ...e, state: "確認済み" as const } : e)),
    [confirmed]
  );
  const pendingCount = events.filter((e) => e.state === "確認待ち").length;
  const calendarDays = useMemo(() => buildCalendar(events), [events]);

  const listRows = useMemo(() => {
    const rows = [...events].sort((a, b) => a.day - b.day || a.time.localeCompare(b.time));
    return filter ? rows.filter((r) => r.kind === filter) : rows;
  }, [events, filter]);

  const listGroups = useMemo(() => {
    const byDay = new Map<number, ScheduleEvent[]>();
    for (const row of listRows) {
      const list = byDay.get(row.day) ?? [];
      list.push(row);
      byDay.set(row.day, list);
    }
    return Array.from(byDay.entries()).map(([day, items]) => ({
      day,
      weekday: WEEKDAY_LABELS[(new Date(SCHEDULE_YEAR, SCHEDULE_MONTH - 1, day).getDay() + 6) % 7],
      items,
      pending: items.filter((i) => i.state === "確認待ち").length,
    }));
  }, [listRows]);

  const selectedEvents = selectedDay ? events.filter((e) => e.day === selectedDay) : [];

  const handleConfirm = (key: string) => {
    setConfirmed((prev) => new Set(prev).add(key));
    toast.success("確認済みにしました（デモ操作です）");
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-xs text-text-secondary">
          {SCHEDULE_YEAR}年{SCHEDULE_MONTH}月　予約 {events.length} 件　うち確認待ち {pendingCount} 件
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-4 text-xs text-text-secondary">
            {KIND_FILTERS.map((kind) => (
              <span key={kind} className="flex items-center gap-2">
                <span className={cn("size-2.5 rounded-sm", KIND_STYLES[kind].legendDot)} />
                {kind}
              </span>
            ))}
            <span className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-destructive" />
              今日（{SCHEDULE_MONTH}/{SCHEDULE_TODAY}）
            </span>
          </div>
          <div className="flex gap-1 rounded-lg border border-border bg-surface-hover p-1">
            <Button
              size="sm"
              variant={view === "cal" ? "secondary" : "ghost"}
              onClick={() => setView("cal")}
            >
              カレンダー
            </Button>
            <Button
              size="sm"
              variant={view === "list" ? "secondary" : "ghost"}
              onClick={() => setView("list")}
            >
              リスト
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 rounded-2xl border border-border bg-surface">
          {view === "cal" ? (
            <div className="p-5">
              <div className="mb-4 flex items-center justify-center gap-6">
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => toast.info("デモ画面のため9月のみ表示しています。")}
                  aria-label="前の月"
                >
                  ‹
                </Button>
                <div className="min-w-32 text-center font-heading text-xl">
                  {SCHEDULE_YEAR}年{SCHEDULE_MONTH}月
                </div>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => toast.info("デモ画面のため9月のみ表示しています。")}
                  aria-label="次の月"
                >
                  ›
                </Button>
              </div>
              <div className="grid grid-cols-7 pb-2.5 text-center text-xs text-text-secondary">
                {WEEKDAY_LABELS.map((w) => (
                  <div key={w} className="py-1.5">
                    {w}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-border">
                {calendarDays.map((day, index) => {
                  const visible = day.events.slice(0, 2);
                  const hasMore = day.events.length > 2;
                  const isSelected = day.inMonth && day.num === selectedDay;
                  return (
                    <button
                      key={index}
                      disabled={!day.inMonth}
                      onClick={() => setSelectedDay(day.num)}
                      className={cn(
                        "flex h-28 flex-col items-stretch gap-1 border-b border-r border-border-subtle px-2.5 py-2 text-left",
                        day.inMonth ? "cursor-pointer bg-surface" : "cursor-default bg-surface-disabled opacity-50",
                        isSelected && "shadow-[inset_0_0_0_1.5px_var(--primary)]",
                        day.isToday && "bg-surface-active shadow-[inset_0_0_0_2px_var(--border-strong)]"
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-5.5 items-center justify-center rounded-full text-xs",
                          day.isToday ? "bg-destructive text-primary-foreground" : "text-text-secondary"
                        )}
                      >
                        {day.num}
                      </span>
                      {visible.map((event) => (
                        <span
                          key={event.key}
                          className={cn(
                            "block truncate rounded-md px-1.5 py-0.5 text-[11px] leading-snug",
                            KIND_STYLES[event.kind].cell
                          )}
                        >
                          <span className="block truncate font-medium">{event.kind}</span>
                          {!hasMore && <span className="block truncate">{event.product}</span>}
                        </span>
                      ))}
                      {hasMore && (
                        <span className="truncate px-1.5 text-[11px] text-text-secondary">
                          他 {day.events.length - 2} 件
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between gap-4 border-b border-border-subtle px-6 py-4">
                <div className="font-heading text-lg">
                  {SCHEDULE_YEAR}年{SCHEDULE_MONTH}月 の予約一覧
                </div>
                <div className="flex gap-2">
                  {KIND_FILTERS.map((kind) => (
                    <button
                      key={kind}
                      onClick={() => setFilter(filter === kind ? null : kind)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs",
                        filter === kind
                          ? "border-primary-border bg-primary-subtle text-primary"
                          : "border-border bg-surface text-text-secondary"
                      )}
                    >
                      {kind}
                    </button>
                  ))}
                </div>
              </div>
              <div className="max-h-[560px] overflow-auto p-5">
                <div className="grid grid-cols-[100px_110px_1fr_190px_100px] rounded-lg border border-border-subtle bg-surface-hover text-xs text-text-secondary">
                  <div className="px-3.5 py-2.5">時刻</div>
                  <div className="px-3.5 py-2.5">種類</div>
                  <div className="px-3.5 py-2.5">商品</div>
                  <div className="px-3.5 py-2.5">変更内容</div>
                  <div className="px-3.5 py-2.5">確認状態</div>
                </div>
                {listGroups.map((group) => (
                  <div key={group.day}>
                    <button
                      onClick={() => setSelectedDay(group.day)}
                      className={cn(
                        "mt-2.5 flex w-full items-baseline gap-3 rounded-t-lg border-b border-border-subtle px-3.5 py-3 text-left",
                        group.day === selectedDay ? "bg-primary-subtle/50" : "bg-surface-hover"
                      )}
                    >
                      <span className="font-heading text-base">
                        {SCHEDULE_MONTH}月{group.day}日
                      </span>
                      <span className="text-xs text-text-secondary">（{group.weekday}）</span>
                      <span className="ml-auto text-xs text-text-secondary">
                        {group.pending > 0
                          ? `${group.items.length} 件　確認待ち ${group.pending} 件`
                          : `${group.items.length} 件　すべて確認済み`}
                      </span>
                    </button>
                    {group.items.map((row) => (
                      <button
                        key={row.key}
                        onClick={() => setSelectedDay(row.day)}
                        className={cn(
                          "grid w-full grid-cols-[100px_110px_1fr_190px_100px] items-center border-b border-border-subtle text-left",
                          row.day === selectedDay ? "bg-primary-subtle/20" : "bg-surface"
                        )}
                      >
                        <span className="px-3.5 py-3 text-xs">{row.time}</span>
                        <span className="px-3.5 py-3">
                          <span className={cn("rounded-full px-2.5 py-0.5 text-[11px]", KIND_STYLES[row.kind].chip)}>
                            {row.kind}
                          </span>
                        </span>
                        <span className="truncate px-3.5 py-3 text-sm">{row.product}</span>
                        <span className="truncate px-3.5 py-3 text-xs text-text-secondary">{row.summary}</span>
                        <span className="px-3.5 py-3">
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-0.5 text-[11px]",
                              row.state === "確認済み"
                                ? "bg-success-subtle text-success-foreground"
                                : "bg-warning-subtle text-warning-foreground"
                            )}
                          >
                            {row.state}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="flex flex-col rounded-2xl border border-border bg-surface">
          <div className="border-b border-border-subtle px-6 py-4">
            <div className="text-xs tracking-wider text-primary">SELECTED DAY</div>
            <div className="mt-2 font-heading text-xl">
              {selectedDay ? `${SCHEDULE_MONTH}月${selectedDay}日` : `${SCHEDULE_MONTH}月`}
            </div>
            <div className="mt-2 flex gap-4 text-xs text-text-secondary">
              <span>予約 {selectedEvents.length} 件</span>
              <span>確認待ち {selectedEvents.filter((e) => e.state === "確認待ち").length} 件</span>
            </div>
          </div>

          <div className="max-h-[560px] overflow-auto px-6 py-2">
            {selectedEvents.length === 0 ? (
              <p className="py-10 text-center text-sm leading-relaxed text-text-secondary">
                この日に登録されている予約はありません。
                <br />
                カレンダーの日付を選ぶと内容が表示されます。
              </p>
            ) : (
              selectedEvents.map((event) => (
                <div key={event.key} className="border-b border-border-subtle py-5 last:border-b-0">
                  <div className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 truncate text-[15px]">{event.product}</span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-0.5 text-[11px]",
                        event.state === "確認済み"
                          ? "bg-success-subtle text-success-foreground"
                          : "bg-warning-subtle text-warning-foreground"
                      )}
                    >
                      {event.state}
                    </span>
                  </div>
                  <div className="mt-2.5 flex items-center gap-3 text-xs text-text-secondary">
                    <span className="font-medium text-foreground">{event.time}</span>
                    <span className={cn("rounded-full px-2.5 py-0.5 text-[11px]", KIND_STYLES[event.kind].chip)}>
                      {event.kind}
                    </span>
                    <span className="min-w-0 truncate">{event.summary}</span>
                  </div>
                  <div className="mt-3 grid gap-2 rounded-lg border border-border-subtle bg-surface-hover p-3.5">
                    {event.diffs.map((diff) => (
                      <div
                        key={diff.label}
                        className="grid grid-cols-[74px_minmax(0,1fr)] items-start gap-x-2.5 gap-y-1 text-xs leading-relaxed"
                      >
                        <span className="pt-px text-text-secondary">{diff.label}</span>
                        <span className="text-text-secondary line-through">{diff.before}</span>
                        <span className="text-right text-primary">→</span>
                        <span>{diff.after}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3.5 flex gap-2.5">
                    <Button
                      size="sm"
                      disabled={event.state === "確認済み"}
                      onClick={() => handleConfirm(event.key)}
                    >
                      {event.state === "確認済み" ? "確認済み" : "内容を確認する"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toast.info("デモ画面です。詳細表示は第2段階で実装予定です。")}
                    >
                      内容を見る
                    </Button>
                    <Button variant="destructive" size="sm">
                      取り消す
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
