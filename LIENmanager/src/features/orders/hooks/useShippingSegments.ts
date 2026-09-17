"use client";

import { useCallback, useEffect, useState } from "react";

import type { ShippingSegment, ShippingSegmentsDTO } from "@/types/order";

// セグメント切替のたびに即座に取り直したい(ポーリング間隔を待たせない)ため、
// 汎用usePollingではなく専用フックにする。手動refresh()も持つ(一時保存/CSV作成の
// 直後に、次のポーリングを待たずその場で件数・一覧を更新するため)。
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

async function fetchSegments(active: ShippingSegment): Promise<ShippingSegmentsDTO> {
  const res = await fetch(`/api/orders/segments?active=${active}`);
  if (!res.ok) throw new Error("failed to load shipping segments");
  return res.json();
}

export function useShippingSegments(active: ShippingSegment) {
  const [data, setData] = useState<ShippingSegmentsDTO | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(true);
  // refresh()が呼ばれるたびインクリメントし、依存配列経由でeffectを即座に再実行させる
  // (usePollingと同じく、setStateはこのeffect内で定義したローカル関数からのみ行う)。
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const result = await fetchSegments(active);
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
    const timer = setInterval(load, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [active, reloadToken]);

  const refresh = useCallback(() => {
    setReloadToken((n) => n + 1);
  }, []);

  return { data, error, isLoading, refresh };
}
