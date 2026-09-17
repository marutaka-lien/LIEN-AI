"use client";

import { useCallback, useEffect, useState } from "react";

import type { OrderDTO } from "@/types/order";

export interface OrderDirectoryParams {
  search: string;
  status: string;
  sort: "orderedAtDesc" | "orderedAtAsc";
  page: number;
}

export interface OrderDirectoryResult {
  orders: OrderDTO[];
  total: number;
  page: number;
  pageSize: number;
}

const DIRECTORY_POLL_INTERVAL_MS = 10 * 60 * 1000;

async function fetchDirectory(params: OrderDirectoryParams): Promise<OrderDirectoryResult> {
  const searchParams = new URLSearchParams();
  if (params.search.trim()) searchParams.set("search", params.search.trim());
  if (params.status) searchParams.set("status", params.status);
  searchParams.set("sort", params.sort);
  searchParams.set("page", String(params.page));

  const res = await fetch(`/api/orders/directory?${searchParams.toString()}`);
  if (!res.ok) throw new Error("failed to load order directory");
  return res.json();
}

// 発送エントリー「注文者情報一覧」タブ用。検索語・ステータス・並び順・ページが
// 変わるたび即座に取り直す(セグメント側のuseShippingSegmentsと同じ考え方・同じ形)。
export function useOrderDirectory(params: OrderDirectoryParams) {
  const [data, setData] = useState<OrderDirectoryResult | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
  const { search, status, sort, page } = params;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const result = await fetchDirectory({ search, status, sort, page });
        if (cancelled) return;
        setData(result);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    const timer = setInterval(load, DIRECTORY_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [search, status, sort, page, reloadToken]);

  const refresh = useCallback(() => {
    setReloadToken((n) => n + 1);
  }, []);

  return { data, error, isLoading, refresh };
}
