import { FileDown, Zap } from "lucide-react";
import Link from "next/link";

/**
 * 「次に実行する推奨アクション」。C案モック準拠:
 * primary-subtle 寄りの持ち上げカード。文＋プライマリボタン1つ＋補助リンク。
 * 対象0件のときはボタンを disabled 表示（理由つき）。
 *
 * CSV 作成の実処理は発送エントリー画面(/automation)側にあるため、ここは
 * その画面への導線（プライマリボタン）として実装する。
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
    <section className="mt-auto rounded-xl border border-primary-border bg-primary-subtle p-4">
      <div className="mb-2 flex items-center gap-2">
        <Zap className="size-[15px] text-primary" aria-hidden />
        <h3 className="font-mono text-xs font-semibold tracking-wide text-primary">
          次に実行する推奨アクション
        </h3>
      </div>
      <p className="mb-3.5 max-w-[42rem] text-sm leading-relaxed">
        {disabled ? (
          <>発送待ちのうち、CSV未出力の注文はありません。新しい発送待ちが入るとここに表示されます。</>
        ) : (
          <>
            発送待ち<span className="font-mono tabular-nums">{pendingShip}</span>件のうち
            <span className="font-mono tabular-nums">{csvUnexported}</span>件がCSV未出力です。
            「対象者CSVを作成」を実行してください。
          </>
        )}
      </p>
      <div className="flex flex-wrap items-center gap-4">
        {disabled ? (
          <span className="inline-flex items-center gap-2 rounded-lg bg-primary/40 px-4 py-2.5 text-sm font-semibold text-primary-foreground opacity-50">
            <FileDown className="size-4" aria-hidden />
            対象者CSVを作成（0件）
          </span>
        ) : (
          <Link
            href="/automation"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover"
          >
            <FileDown className="size-4" aria-hidden />
            対象者CSVを作成（<span className="font-mono tabular-nums">{csvUnexported}</span>件）
          </Link>
        )}
        {disabled && (
          <span className="text-xs text-muted-foreground">対象が0件のため実行できません</span>
        )}
        <Link href="/automation" className="text-xs font-medium text-primary hover:underline">
          発送エントリー画面を開く →
        </Link>
      </div>
    </section>
  );
}
