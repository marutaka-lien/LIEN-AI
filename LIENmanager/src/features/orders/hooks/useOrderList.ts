"use client";

import { useCallback } from "react";

import { usePolling } from "@/features/automation/hooks/usePolling";
import type { OrderDTO } from "@/types/order";

// 常に最新の注文一覧を表示するため、10分間隔で自動更新する(ユーザー指定)。
const ORDER_LIST_POLL_INTERVAL_MS = 10 * 60 * 1000;

export interface UseOrderListFilters {
  // 今日(JST)の注文のみに絞る。
  todayOnly?: boolean;
  // 処理が完了していない注文(注文確認待ち・発送待ち)のみに絞る。
  pendingOnly?: boolean;
}

async function fetchOrders(filters: UseOrderListFilters): Promise<OrderDTO[]> {
  const params = new URLSearchParams();
  if (filters.todayOnly) params.set("todayOnly", "true");
  if (filters.pendingOnly) params.set("pendingOnly", "true");

  const query = params.toString();
  const res = await fetch(`/api/orders${query ? `?${query}` : ""}`);
  if (!res.ok) throw new Error("failed to load orders");
  const data: { orders: OrderDTO[] } = await res.json();
  return data.orders;
}

function neverSettled(): boolean {
  return false;
}

export function useOrderList(filters: UseOrderListFilters = {}) {
  const { todayOnly, pendingOnly } = filters;
  const fetcher = useCallback(
    () => fetchOrders({ todayOnly, pendingOnly }),
    [todayOnly, pendingOnly]
  );

  return usePolling<OrderDTO[]>({
    enabled: true,
    fetcher,
    isSettled: neverSettled,
    intervalMs: ORDER_LIST_POLL_INTERVAL_MS,
  });
}
