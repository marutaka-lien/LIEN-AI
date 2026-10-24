import { ArrowRight, FileDown } from "lucide-react";
import Link from "next/link";

import { AnimatedNumber } from "@/components/ui/animated-number";
import { RingGauge } from "@/components/dashboard/infographic/ring-gauge";

/**
 * 「次に実行する推奨アクション」。画面で一番大事な操作なので最上段に置く。
 * リング＝発送待ちのうちCSV未出力の割合。対象0件のときはボタンを disabled 表示（理由つき）。
 * CSV 作成の実処理は発送エントリー画面(/automation)側にあるため、ここはその画面への導線。
 */
export function NextActionCard({
  pendingShip,
  csvUnexported,
}: {
  pendingShip: number;
  csvUnexported: number;
}) {
  const disabled = csvUnexported === 0;

  return (
    <section className="glass glass-tint-primary lg-rise flex flex-col gap-5 rounded-[1.75rem] p-6 sm:flex-row sm:items-center">
      <RingGauge
        value={csvUnexported}
        max={pendingShip}
        size={112}
        tone="primary"
        label={`発送待ち${pendingShip}件のうち${csvUnexported}件がCSV未出力`}
      >
        <div className="flex flex-col items-center leading-none">
          <AnimatedNumber value={csvUnexported} className="text-3xl font-semibold tracking-tight" />
          <span className="mt-1 text-[0.68rem] text-text-secondary">/ {pendingShip}件</span>
        </div>
      </RingGauge>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <p className="text-[0.95rem] leading-relaxed">
          {disabled ? (
            <>CSV未出力の注文はありません。新しい発送待ちが入るとここに出ます。</>
          ) : (
            <>
              発送待ち<span className="font-semibold tabular-nums">{pendingShip}</span>件のうち
              <span className="font-semibold tabular-nums text-primary">{csvUnexported}</span>
              件がCSV未出力です。
            </>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          {disabled ? (
            <span
              aria-disabled="true"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[oklch(0.235_0.018_262/6%)] px-5 text-sm font-semibold text-text-disabled"
            >
              <FileDown className="size-4" aria-hidden />
              対象者CSVを作成（0件）
            </span>
          ) : (
            <Link
              href="/automation"
              className="lg-press inline-flex h-11 items-center gap-2 rounded-xl bg-[linear-gradient(180deg,oklch(0.6_0.12_24),var(--primary))] px-5 text-sm font-semibold text-primary-foreground shadow-[inset_0_1px_0_oklch(1_0_0/35%),0_8px_20px_-8px_oklch(0.555_0.118_24/65%)]"
            >
              <FileDown className="size-4" aria-hidden />
              対象者CSVを作成（<span className="tabular-nums">{csvUnexported}</span>件）
            </Link>
          )}
          {disabled && <span className="text-xs text-text-secondary">対象が0件のため実行できません</span>}
          <Link
            href="/automation"
            className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            発送エントリーへ
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
