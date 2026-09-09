import type { ThroughputSeries } from "@/lib/operations-dashboard";

// 「本日の処理推移」。自前 SVG（チャートライブラリは使わない）。
// 2本の折れ線: 発送完了累計（実線）／受注累計（点線）。13:00 に締切目安の縦破線。
// データが無い時間帯は描かない（buildThroughputSeries が現在時で打ち切る）。

const VIEW_W = 560;
const VIEW_H = 210;
const X_LEFT = 44;
const X_RIGHT = 524;
const Y_TOP = 16;
const Y_BASE = 170;

// SVG の stroke/fill は CSS 変数を直接指せないためインラインで参照する（この用途に限る）。
const COLOR_SHIPPED = "var(--success-foreground)";
const COLOR_ORDERED = "var(--accent-cyan)";
const COLOR_DEADLINE = "var(--warning-foreground)";
const COLOR_GRID = "var(--border-subtle)";
const COLOR_AXIS = "var(--muted-foreground)";

function xForIndex(index: number, length: number): number {
  if (length <= 1) return X_RIGHT;
  return X_LEFT + ((X_RIGHT - X_LEFT) * index) / (length - 1);
}

function yForValue(value: number, yMax: number): number {
  return Y_BASE - ((Y_BASE - Y_TOP) * value) / yMax;
}

function toPath(values: number[], yMax: number): string {
  return values
    .map((value, index) => `${index === 0 ? "M" : "L"}${xForIndex(index, values.length).toFixed(1)} ${yForValue(value, yMax).toFixed(1)}`)
    .join(" ");
}

export function ThroughputChart({ series }: { series: ThroughputSeries }) {
  if (!series.hasData) {
    return (
      <section className="rounded-xl border border-border-subtle bg-surface-elevated p-4">
        <ChartHeading />
        <div className="flex h-[180px] items-center justify-center rounded-lg border border-dashed border-border-subtle text-sm text-text-secondary">
          本日の処理はまだありません
        </div>
      </section>
    );
  }

  const { hours, orderedCumulative, shippedCumulative, yMax } = series;
  const gridValues = [0, yMax / 2, yMax];
  const deadlineHour = 13;
  const showDeadline = hours[0] <= deadlineHour && hours[hours.length - 1] >= deadlineHour;
  const deadlineX =
    X_LEFT +
    ((X_RIGHT - X_LEFT) * (deadlineHour - hours[0])) / Math.max(1, hours[hours.length - 1] - hours[0]);

  const lastIndex = hours.length - 1;
  const shippedEndY = yForValue(shippedCumulative[lastIndex], yMax);
  const orderedEndY = yForValue(orderedCumulative[lastIndex], yMax);

  return (
    <section className="rounded-xl border border-border-subtle bg-surface-elevated p-4">
      <ChartHeading />
      <div className="mb-2 flex flex-wrap items-center gap-4 text-[0.7rem] text-text-secondary">
        <Legend color={COLOR_SHIPPED} label="発送完了（累計）" />
        <Legend color={COLOR_ORDERED} label="受注（累計）" dashed />
        {showDeadline && <Legend color={COLOR_DEADLINE} label="締切目安 13:00" dashed thin />}
      </div>

      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        width="100%"
        height={VIEW_H}
        role="img"
        aria-label={`本日の処理推移（累計）${hours[0]}時から${hours[lastIndex]}時`}
      >
        {gridValues.map((value) => {
          const y = yForValue(value, yMax);
          return (
            <g key={value}>
              <line x1={X_LEFT} y1={y} x2={X_RIGHT} y2={y} stroke={COLOR_GRID} />
              <text x={X_LEFT - 8} y={y + 3} textAnchor="end" fontSize="10" fill={COLOR_AXIS} className="tabular-nums">
                {Math.round(value)}
              </text>
            </g>
          );
        })}

        {showDeadline && (
          <>
            <line
              x1={deadlineX}
              y1={Y_TOP - 2}
              x2={deadlineX}
              y2={Y_BASE}
              stroke={COLOR_DEADLINE}
              strokeWidth={1.4}
              strokeDasharray="4 4"
              opacity={0.6}
            />
            <text x={deadlineX} y={Y_TOP - 6} textAnchor="middle" fontSize="9" fill={COLOR_DEADLINE}>
              13:00
            </text>
          </>
        )}

        <path
          d={toPath(orderedCumulative, yMax)}
          fill="none"
          stroke={COLOR_ORDERED}
          strokeWidth={2}
          strokeDasharray="5 4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={toPath(shippedCumulative, yMax)}
          fill="none"
          stroke={COLOR_SHIPPED}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <circle cx={xForIndex(lastIndex, hours.length)} cy={shippedEndY} r={3} fill={COLOR_SHIPPED} />
        <circle cx={xForIndex(lastIndex, hours.length)} cy={orderedEndY} r={3} fill={COLOR_ORDERED} />

        {hours.map((hour, index) => (
          <text
            key={hour}
            x={xForIndex(index, hours.length)}
            y={Y_BASE + 20}
            textAnchor="middle"
            fontSize="10"
            fill={COLOR_AXIS}
            className="tabular-nums"
          >
            {hour}
          </text>
        ))}
        <text x={X_RIGHT} y={Y_BASE + 36} textAnchor="end" fontSize="9" fill={COLOR_AXIS}>
          時（単位：件）
        </text>
      </svg>

      <div className="mt-1 flex gap-4 border-t border-border-subtle pt-2 text-xs text-text-secondary">
        <span>
          発送完了 <span className="font-mono tabular-nums text-foreground">{shippedCumulative[lastIndex]}</span>
        </span>
        <span>
          受注 <span className="font-mono tabular-nums text-foreground">{orderedCumulative[lastIndex]}</span>
        </span>
      </div>
    </section>
  );
}

function ChartHeading() {
  return (
    <div className="mb-3">
      <h3 className="text-sm font-semibold">本日の処理推移</h3>
      <p className="font-mono text-[0.65rem] tracking-wide text-muted-foreground">
        累計 / 9:00–16:00 / 件数
      </p>
    </div>
  );
}

function Legend({
  color,
  label,
  dashed = false,
  thin = false,
}: {
  color: string;
  label: string;
  dashed?: boolean;
  thin?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width="18" height="8" aria-hidden>
        <line
          x1="0"
          y1="4"
          x2="18"
          y2="4"
          stroke={color}
          strokeWidth={thin ? 1.5 : 2}
          strokeDasharray={dashed ? "4 3" : undefined}
        />
      </svg>
      {label}
    </span>
  );
}
