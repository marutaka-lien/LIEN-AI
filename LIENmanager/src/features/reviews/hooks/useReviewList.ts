"use client";

import { useCallback } from "react";

import { usePolling } from "@/features/automation/hooks/usePolling";
import type { ReviewDTO } from "@/types/review";

// 常に最新のレビュー一覧を表示するため、10分間隔で自動更新する(useOrderList.tsと同方針)。
const REVIEW_LIST_POLL_INTERVAL_MS = 10 * 60 * 1000;

export interface UseReviewListFilters {
  reviewType?: string; // "product" | "shop"
  rating?: number;
  sinceDays?: number;
}

async function fetchReviews(filters: UseReviewListFilters): Promise<ReviewDTO[]> {
  const params = new URLSearchParams();
  if (filters.reviewType) params.set("reviewType", filters.reviewType);
  if (filters.rating !== undefined) params.set("rating", String(filters.rating));
  if (filters.sinceDays !== undefined) params.set("sinceDays", String(filters.sinceDays));

  const query = params.toString();
  const res = await fetch(`/api/reviews${query ? `?${query}` : ""}`);
  if (!res.ok) throw new Error("failed to load reviews");
  const data: { reviews: ReviewDTO[] } = await res.json();
  return data.reviews;
}

function neverSettled(): boolean {
  return false;
}

// refreshKeyが変わるとfetcherの参照が変わり、usePolling内のeffectが即座に再実行される。
// レビュー同期完了直後に一覧を即時更新するために使う(10分ポーリングを待たせないため)。
export function useReviewList(filters: UseReviewListFilters = {}, refreshKey: string | number = 0) {
  const { reviewType, rating, sinceDays } = filters;
  const fetcher = useCallback(
    () => fetchReviews({ reviewType, rating, sinceDays }),
    [reviewType, rating, sinceDays, refreshKey]
  );

  return usePolling<ReviewDTO[]>({
    enabled: true,
    fetcher,
    isSettled: neverSettled,
    intervalMs: REVIEW_LIST_POLL_INTERVAL_MS,
  });
}
