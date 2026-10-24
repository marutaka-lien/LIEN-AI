import type { CSSProperties, ReactNode } from "react";

type Tone = "primary" | "success" | "warning" | "cyan";

const TONE_STROKE: Record<Tone, string> = {
  primary: "var(--primary)",
  success: "var(--success-foreground)",
  warning: "var(--warning-foreground)",
  cyan: "var(--accent-cyan)",
};

/**
 * 比率を表すリング。線が0から目標の割合まで描かれる（CSSアニメーション lg-ring）。
 * 中央には children（数値など）を置ける。label は読み上げ用の要約。
 */
export function RingGauge({
  value,
  max,
  size = 64,
  tone = "primary",
  delay = 0,
  label,
  children,
}: {
  value: number;
  max: number;
  size?: number;
  tone?: Tone;
  delay?: number;
  label: string;
  children?: ReactNode;
}) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 36 36" width={size} height={size} role="img" aria-label={label}>
        <circle cx="18" cy="18" r="15" fill="none" stroke="oklch(0.235 0.018 262 / 8%)" strokeWidth="3.2" />
        {percent > 0 && (
          <circle
            cx="18"
            cy="18"
            r="15"
            fill="none"
            stroke={TONE_STROKE[tone]}
            strokeWidth="3.2"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray="100"
            strokeDashoffset={100 - percent}
            transform="rotate(-90 18 18)"
            className="lg-ring"
            style={{ "--delay": `${delay}ms` } as CSSProperties}
          />
        )}
      </svg>
      {children && <div className="absolute inset-0 flex items-center justify-center">{children}</div>}
    </div>
  );
}
