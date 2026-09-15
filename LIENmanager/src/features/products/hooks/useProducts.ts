"use client";

import { useCallback, useEffect, useState } from "react";

import type { Product } from "@/types/product";

export interface ProductsResult {
  products: Product[];
  totalFound: number;
  skippedCount: number;
  inventoryError: string | null;
}

async function fetchProducts(): Promise<ProductsResult> {
  const res = await fetch("/api/products");
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? "failed to load products");
  }
  return res.json();
}

// 商品一覧タブ用。RMSへの都度問い合わせのため、自動ポーリングはせず
// マウント時の取得＋手動の「最新化」ボタン(refresh)のみで更新する。
export function useProducts() {
  const [data, setData] = useState<ProductsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const result = await fetchProducts();
        if (cancelled) return;
        setData(result);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "unknown error");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const refresh = useCallback(() => {
    setReloadToken((n) => n + 1);
  }, []);

  return { data, error, isLoading, refresh };
}
