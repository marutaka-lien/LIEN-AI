import { MOCK_PRODUCTS, MOCK_SCHEDULES } from "@/lib/mock-products";

export function ReservationStatus() {
  const scheduled = MOCK_PRODUCTS.filter((product) => (MOCK_SCHEDULES[product.id] ?? []).length > 0);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-secondary">
        商品登録・更新の公開予約をまとめて確認できます。何を自動化するかはグランドマスターの回答待ちのため、
        現在は見た目のみの準備段階です。
      </p>

      {scheduled.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-text-secondary">
          登録されている公開予約はありません。
        </div>
      ) : (
        <div className="divide-y divide-border-subtle rounded-2xl border border-border bg-surface">
          {scheduled.map((product) =>
            (MOCK_SCHEDULES[product.id] ?? []).map((schedule) => (
              <div key={schedule.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <span className="rounded-full bg-success-subtle px-2.5 py-0.5 text-xs text-success-foreground">
                  {schedule.state}
                </span>
                <span className="font-heading text-base">{schedule.when}</span>
                <span className="text-sm text-text-secondary">{product.name}</span>
                <span className="flex-1 text-sm text-text-secondary">{schedule.what}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
