"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 数値を0（または直前の値）から目標値までカウントアップして見せる。
 * - 「動きを減らす」設定のときは最初のフレームで目標値を出す。
 * - 読み上げには目標値だけを渡し、途中の数字は aria-hidden にする。
 * サーバーコンポーネントから使えるよう、整形は関数ではなく fractionDigits で指定する。
 */
export function AnimatedNumber({
  value,
  fractionDigits = 0,
  duration = 1100,
  delay = 0,
  className,
}: {
  value: number;
  fractionDigits?: number;
  duration?: number;
  delay?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);
  const displayRef = useRef(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = displayRef.current;
    const total = reduce ? 0 : duration;
    let raf = 0;
    let start: number | null = null;

    const tick = (now: number) => {
      if (start === null) start = now + (reduce ? 0 : delay);
      const progress = total === 0 ? 1 : Math.min(1, Math.max(0, (now - start) / total));
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const next = from + (value - from) * eased;
      displayRef.current = next;
      setDisplay(next);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, delay]);

  const format = (n: number) =>
    n.toLocaleString("ja-JP", {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });

  return (
    <span className={className}>
      <span className="sr-only">{format(value)}</span>
      <span aria-hidden className="tabular-nums">
        {format(display)}
      </span>
    </span>
  );
}
