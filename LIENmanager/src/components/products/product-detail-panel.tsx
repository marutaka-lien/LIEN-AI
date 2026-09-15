"use client";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import type { Product } from "@/types/product";
import { ProductStateBadge } from "./product-state-badge";

export function ProductDetailPanel({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const maxTrend = product.trend.length > 0 ? Math.max(...product.trend) : 0;

  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-border bg-surface-elevated shadow-xl">
      <div className="flex items-center gap-4 border-b border-border-subtle px-6 py-4">
        <div className="size-10 shrink-0 overflow-hidden rounded-lg bg-surface-hover">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- 楽天R-Cabinetの外部ドメイン画像のためnext/imageの最適化対象外
            <img src={product.imageUrl} alt={product.name} className="size-full object-cover" />
          ) : (
            <div
              className="size-full"
              style={{
                background: `linear-gradient(155deg, ${product.colors[0] ?? "#efe6d8"}, ${product.colors[1] ?? "#e4dbd1"})`,
              }}
            />
          )}
        </div>
        <div className="flex min-w-0 items-center gap-3">
          <h2 className="truncate font-heading text-lg">{product.name}</h2>
          <ProductStateBadge state={product.state} />
        </div>
        <span className="text-xs text-text-secondary">{product.code}</span>
        <Button
          variant="outline"
          size="icon-sm"
          className="ml-auto"
          aria-label="詳細を閉じる"
          onClick={onClose}
        >
          ×
        </Button>
      </div>

      <Tabs defaultValue="sales" className="min-h-0 flex-1 gap-0 overflow-y-auto px-6 py-5">
        <TabsList>
          <TabsTab value="sales">売れ行き</TabsTab>
          <TabsTab value="info">商品情報</TabsTab>
          <TabsTab value="schedule">予約</TabsTab>
          <TabsTab value="history">変更履歴</TabsTab>
        </TabsList>

        <TabsPanel value="sales" className="pt-5">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-[300px_minmax(0,1fr)]">
            <div className="grid grid-cols-2 gap-5">
              <Metric label="直近30日の販売" value={product.sold30d !== null ? `${product.sold30d}` : "－"} />
              <Metric label="購入率" value={product.cvr ?? "－"} />
              <Metric label="今月の売上" value={product.revenue ?? "－"} />
              <Metric label="レビュー" value={product.rating ?? "－"} />
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-text-secondary">販売動向　直近6ヶ月</span>
              </div>
              {product.trend.length > 0 ? (
                <div className="mt-4 flex h-28 items-end gap-1.5">
                  {product.trend.map((value, index) => (
                    <span
                      key={index}
                      className="w-full rounded-t bg-primary/60"
                      style={{ height: `${Math.max(6, (value / maxTrend) * 100)}%` }}
                    />
                  ))}
                </div>
              ) : (
                <div className="mt-4 flex h-28 items-center justify-center rounded-xl border border-dashed border-border-subtle text-xs text-text-secondary">
                  週次データを蓄積中です
                </div>
              )}
            </div>
          </div>
        </TabsPanel>

        <TabsPanel value="info" className="pt-5">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div>
              <p className="max-w-xl text-sm leading-7 text-text-secondary">{product.description}</p>
              <dl className="mt-5 grid grid-cols-[92px_1fr_92px_1fr] gap-x-4 gap-y-3 text-sm">
                <dt className="text-text-secondary">品番</dt>
                <dd>{product.code}</dd>
                <dt className="text-text-secondary">カテゴリ</dt>
                <dd>{product.category ?? "－"}</dd>
                <dt className="text-text-secondary">素材</dt>
                <dd>{product.material ?? "－"}</dd>
                <dt className="text-text-secondary">シーズン</dt>
                <dd>{product.season ?? "－"}</dd>
                <dt className="text-text-secondary">価格</dt>
                <dd>{product.price}</dd>
                <dt className="text-text-secondary">在庫合計</dt>
                <dd>{product.stock ?? "－"}</dd>
              </dl>
              <div className="mt-7 flex gap-3">
                <Button onClick={() => toast.info("デモ操作です（プロジェクトM 第2段階で実装予定）")}>
                  編集する
                </Button>
                <Button
                  variant="outline"
                  onClick={() => toast.info("デモ操作です（プロジェクトM 第2段階で実装予定）")}
                >
                  コピーして登録
                </Button>
              </div>
            </div>
            <div>
              <span className="text-xs text-text-secondary">色とサイズの在庫</span>
              {product.stockMatrix.length === 0 ? (
                <div className="mt-3 rounded-xl border border-dashed border-border-subtle py-8 text-center text-xs text-text-secondary">
                  在庫データは未対応です（在庫APIとの連携は今後追加予定）
                </div>
              ) : (
              <div className="mt-3 overflow-hidden rounded-xl border border-border-subtle">
                <div
                  className="grid border-b border-border-subtle bg-surface-hover text-center text-xs text-text-secondary"
                  style={{ gridTemplateColumns: `110px repeat(${product.sizes.length}, 1fr)` }}
                >
                  <div />
                  {product.sizes.map((size) => (
                    <div key={size} className="py-2">
                      {size}
                    </div>
                  ))}
                </div>
                {product.stockMatrix.map((row) => (
                  <div
                    key={row.color}
                    className="grid items-center border-b border-border-subtle last:border-b-0"
                    style={{ gridTemplateColumns: `110px repeat(${row.cells.length}, 1fr)` }}
                  >
                    <div className="flex items-center gap-2.5 py-2.5 text-xs">
                      <span
                        className="size-3 rounded-full border border-border-subtle"
                        style={{ background: row.swatch }}
                      />
                      {row.color}
                    </div>
                    {row.cells.map((count, index) => (
                      <div
                        key={index}
                        className={`py-2.5 text-center text-xs ${count === 0 ? "text-text-disabled" : ""}`}
                      >
                        {count}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              )}
            </div>
          </div>
        </TabsPanel>

        <TabsPanel value="schedule" className="pt-5">
          <p className="py-10 text-center text-sm text-text-secondary">
            この商品に登録されている予約はありません。（予約機能は今後追加予定）
          </p>
        </TabsPanel>

        <TabsPanel value="history" className="pt-5">
          <p className="py-10 text-center text-sm text-text-secondary">
            変更履歴はありません。（変更履歴の記録は今後追加予定）
          </p>
        </TabsPanel>
      </Tabs>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-text-secondary">{label}</div>
      <div className="mt-2 font-heading text-2xl">{value}</div>
    </div>
  );
}
