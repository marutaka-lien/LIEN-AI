"use client";

import { useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { useProducts } from "@/features/products/hooks/useProducts";
import type { Product, ProductState } from "@/types/product";
import { ProductDetailPanel } from "./product-detail-panel";
import { ProductStateBadge } from "./product-state-badge";

const SORT_OPTIONS = ["売れている順", "在庫が少ない順", "購入率が高い順", "更新が新しい順"] as const;
type SortOption = (typeof SORT_OPTIONS)[number];

const STATE_FILTERS: Array<{ value: ProductState | "all"; label: string }> = [
  { value: "all", label: "すべて" },
  { value: "公開中", label: "公開中" },
  { value: "在庫注意", label: "在庫注意" },
  { value: "下書き", label: "下書き" },
];

function sortProducts(products: Product[], sort: SortOption): Product[] {
  const sorted = [...products];
  switch (sort) {
    case "在庫が少ない順":
      return sorted.sort((a, b) => (a.stock ?? Infinity) - (b.stock ?? Infinity));
    case "購入率が高い順":
      return sorted.sort(
        (a, b) => (b.cvr ? parseFloat(b.cvr) : -Infinity) - (a.cvr ? parseFloat(a.cvr) : -Infinity)
      );
    case "更新が新しい順":
      return sorted;
    case "売れている順":
    default:
      return sorted.sort((a, b) => (b.sold30d ?? -Infinity) - (a.sold30d ?? -Infinity));
  }
}

export function ProductList() {
  const { data, error, isLoading, refresh } = useProducts();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOption>("売れている順");
  const [stateFilter, setStateFilter] = useState<ProductState | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const products = data?.products ?? [];
    const q = query.trim().toLowerCase();
    const byQuery = products.filter((p) => {
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
    });
    const byState =
      stateFilter === "all" ? byQuery : byQuery.filter((p) => p.state === stateFilter);
    return sortProducts(byState, sort);
  }, [data, query, sort, stateFilter]);

  const selected = filtered.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex h-11 w-full items-center gap-2.5 rounded-lg border border-border bg-surface px-4 sm:w-72">
          <Search className="size-4 text-text-secondary" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="商品名・品番で検索"
            className="w-full bg-transparent text-sm outline-none placeholder:text-text-secondary"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2">
            {STATE_FILTERS.map((chip) => (
              <button
                key={chip.value}
                onClick={() => setStateFilter(chip.value)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  stateFilter === chip.value
                    ? "border-primary-border bg-primary-subtle text-primary"
                    : "border-border bg-surface text-text-secondary hover:text-foreground"
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="h-11 rounded-lg border border-border bg-surface px-3 text-sm"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <button
            onClick={refresh}
            disabled={isLoading}
            className="flex h-11 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm text-text-secondary transition-colors hover:text-foreground disabled:opacity-60"
          >
            <RefreshCw className={cn("size-4", isLoading && "animate-spin")} />
            最新化
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-warning-border bg-warning-subtle px-4 py-3 text-sm text-warning-foreground">
          楽天(RMS)から商品データを取得できませんでした。{error}
        </div>
      )}

      {isLoading && !data ? (
        <div className="rounded-2xl border border-dashed border-border py-20 text-center text-sm text-text-secondary">
          楽天(RMS)から商品データを取得しています…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-20 text-center text-sm text-text-secondary">
          条件に合う商品がありません。
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((product) => (
            <button
              key={product.id}
              onClick={() => setSelectedId(product.id === selectedId ? null : product.id)}
              className={cn(
                "rounded-2xl border bg-surface p-4 text-left transition-colors hover:border-primary-border",
                selectedId === product.id ? "border-primary-border bg-primary-subtle/40" : "border-border"
              )}
            >
              <div className="aspect-square w-full overflow-hidden rounded-xl bg-surface-hover">
                {product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- 楽天R-Cabinetの外部ドメイン画像のためnext/imageの最適化対象外
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="size-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div
                    className="size-full"
                    style={{
                      background: `linear-gradient(155deg, ${product.colors[0] ?? "#efe6d8"}, ${product.colors[1] ?? "#e4dbd1"})`,
                    }}
                  />
                )}
              </div>
              <div className="mt-4 flex items-baseline gap-2.5">
                <span className="truncate text-sm">{product.name}</span>
                <ProductStateBadge state={product.state} className="shrink-0" />
              </div>
              <div className="mt-2 font-heading text-base">{product.price}</div>
              <div className="mt-3 flex gap-4 text-xs text-text-secondary">
                <span>在庫 {product.stock ?? "－"}</span>
                <span>30日 {product.sold30d ?? "－"}</span>
                <span>購入率 {product.cvr ?? "－"}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <ProductDetailPanel product={selected} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
