"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { REGISTRATION_STEP_LABELS } from "@/lib/mock-products";

type PublishMode = "draft" | "now" | "schedule";

const TOTAL_STEPS = REGISTRATION_STEP_LABELS.length;

// 見た目確認用：まだ入力していないことにしておく必須項目（デモ用の固定値）
const MISSING_BY_STEP: Record<number, number> = { 5: 1, 6: 1 };

export function ProductRegistrationWizard() {
  const [step, setStep] = useState(1);
  const [publish, setPublish] = useState<PublishMode>("schedule");

  const goTo = (n: number) => setStep(Math.max(1, Math.min(TOTAL_STEPS, n)));
  const missingCount = Object.values(MISSING_BY_STEP).reduce((a, b) => a + b, 0);

  const handleSaveDraft = () => {
    toast.success("一時保存しました（デモ）。「続きから再開」でいつでも戻れます。");
  };

  const handleNext = () => {
    if (step === TOTAL_STEPS) {
      toast.info("これはデモ画面です。楽天への登録はプロジェクトM 第2段階以降で実装します。");
      return;
    }
    goTo(step + 1);
  };

  return (
    <div className="grid min-h-0 grid-cols-1 gap-5 lg:grid-cols-[280px_minmax(0,1fr)_340px]">
      {/* 左: ステップ一覧 */}
      <aside className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
        <div className="px-2 text-xs tracking-wider text-text-secondary">
          STEPS　{step - 1} / {TOTAL_STEPS} 完了
        </div>
        <div className="mx-2 h-1 overflow-hidden rounded-full bg-surface-hover">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.round(((step - 1) / (TOTAL_STEPS - 1)) * 100)}%` }}
          />
        </div>
        <div className="flex flex-col gap-0.5">
          {REGISTRATION_STEP_LABELS.map((label, index) => {
            const n = index + 1;
            const active = n === step;
            const done = n < step && !MISSING_BY_STEP[n];
            const missing = MISSING_BY_STEP[n];
            return (
              <button
                key={label}
                onClick={() => goTo(n)}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-sm transition-colors",
                  active
                    ? "bg-primary-subtle font-medium text-foreground shadow-[inset_2px_0_var(--primary)]"
                    : done
                      ? "text-text-secondary hover:bg-surface-hover"
                      : "text-text-disabled hover:bg-surface-hover"
                )}
              >
                <span
                  className={cn(
                    "flex size-5.5 shrink-0 items-center justify-center rounded-full text-[11px]",
                    active
                      ? "bg-primary text-primary-foreground"
                      : done
                        ? "bg-success-subtle text-success-foreground"
                        : "bg-surface-hover text-text-disabled"
                  )}
                >
                  {done ? "✓" : n}
                </span>
                <span className="flex-1">{label}</span>
                {missing ? (
                  <span className="rounded-full bg-warning-subtle px-2 py-0.5 text-[10.5px] text-warning-foreground">
                    未入力 {missing}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <p className="mt-auto border-t border-border-subtle px-2 pt-3 text-[11px] leading-relaxed text-text-secondary">
          未入力の必須項目がある段階には件数を表示します。すべて埋まるまで楽天へは登録できません。
        </p>
      </aside>

      {/* 中央: フォーム本体 */}
      <section className="flex min-h-0 flex-col rounded-2xl border border-border bg-surface">
        <div className="min-h-0 flex-1 overflow-auto p-7">
          <StepContent step={step} publish={publish} onSetPublish={setPublish} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border-subtle bg-surface-hover px-7 py-4">
          <div className="flex items-center gap-3 text-xs text-success-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-success-foreground" />
              楽天にはまだ送信されません
            </span>
          </div>
          <div className="flex gap-2.5">
            <Button variant="outline" onClick={handleSaveDraft}>
              一時保存
            </Button>
            <Button variant="outline" onClick={() => goTo(step - 1)} disabled={step === 1}>
              戻る
            </Button>
            <Button onClick={handleNext}>
              {step === TOTAL_STEPS ? "楽天へ登録する" : step === TOTAL_STEPS - 1 ? "最終確認へ →" : "次へ進む →"}
            </Button>
          </div>
        </div>
      </section>

      {/* 右: プレビューと未入力項目 */}
      <aside className="flex flex-col gap-4">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="text-xs tracking-wider text-text-secondary">DRAFT PREVIEW</div>
          <div className="mt-3 aspect-4/3 rounded-xl bg-gradient-to-br from-[#efe7de] to-[#e4dbd1]" />
          <div className="mt-3 text-[11px] text-text-secondary">5102-AW26</div>
          <div className="mt-1 text-sm leading-relaxed">綿シフォン ハイネックインナー 2026AW</div>
          <div className="mt-1.5 font-heading text-lg">¥2,680</div>
        </div>

        <div className="flex-1 rounded-2xl border border-border bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs tracking-wider text-text-secondary">未入力の必須項目</span>
            <span className="rounded-full bg-warning-subtle px-2.5 py-0.5 text-xs text-warning-foreground">
              {missingCount}件
            </span>
          </div>
          <div className="flex flex-col gap-2.5 text-sm text-text-secondary">
            <div className="flex items-center gap-2.5">
              <span className="size-1.5 shrink-0 rounded-full bg-warning-foreground" />
              5 商品画像 ／ 4枚目以降の登録
            </div>
            <div className="flex items-center gap-2.5">
              <span className="size-1.5 shrink-0 rounded-full bg-warning-foreground" />6 商品説明 ／ スマートフォン用説明文
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2 border-t border-border-subtle pt-4">
            <Button
              variant="outline"
              onClick={() => toast.info("デモ画面です。プレビューは第2段階で実装予定です。")}
            >
              楽天の表示イメージを見る
            </Button>
            <Button variant="outline" onClick={() => goTo(TOTAL_STEPS)}>
              最終確認へ進む
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  defaultValue,
  className,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  defaultValue?: string;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="flex justify-between text-xs text-text-secondary">
        <span>
          {label}
          {required && <span className="ml-1.5 text-primary">必須</span>}
        </span>
        {hint && <span>{hint}</span>}
      </span>
      <input
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2.5 text-sm outline-none focus-visible:border-primary"
      />
    </label>
  );
}

function SelectField({
  label,
  required,
  options,
}: {
  label: string;
  required?: boolean;
  options: string[];
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-text-secondary">
        {label}
        {required && <span className="ml-1.5 text-primary">必須</span>}
      </span>
      <select className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2.5 text-sm">
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function StepContent({
  step,
  publish,
  onSetPublish,
}: {
  step: number;
  publish: PublishMode;
  onSetPublish: (mode: PublishMode) => void;
}) {
  const eyebrow = (n: number) => (
    <div className="text-xs tracking-wider text-primary">
      STEP {n} / {TOTAL_STEPS}
    </div>
  );
  const title = (text: string) => <h2 className="mb-1.5 mt-1.5 font-heading text-2xl">{text}</h2>;

  switch (step) {
    case 1:
      return (
        <div>
          {eyebrow(1)}
          {title("登録方法を選ぶ")}
          <p className="text-sm text-text-secondary">
            似た商品がある場合は複製すると、配送設定やカテゴリーなど共通項目の入力を省けます。
          </p>
          <div className="mt-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <button className="rounded-xl border border-primary-border bg-primary-subtle p-5 text-left">
              <strong className="mb-2 block text-sm">既存商品を複製</strong>
              <span className="text-xs leading-relaxed text-text-secondary">
                商品を選び、変更する部分だけ書き換えます。所要 約8分。
              </span>
            </button>
            <button className="rounded-xl border border-border bg-surface-hover p-5 text-left hover:border-primary-border">
              <strong className="mb-2 block text-sm">ゼロから登録</strong>
              <span className="text-xs leading-relaxed text-text-secondary">
                すべての項目を新しく入力します。所要 約25分。
              </span>
            </button>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 border-t border-border-subtle pt-5 sm:grid-cols-2">
            <SelectField
              label="複製する商品"
              required
              options={[
                "綿シフォン ハイネックインナー（1000000115）",
                "アイボリーインナー（5102-IV）",
                "ブラックインナー（5102-BK）",
              ]}
            />
            <Field label="新しい商品管理番号" required defaultValue="5102-AW26" />
          </div>
          <div className="mt-5 rounded-lg border border-border-subtle bg-surface-hover p-4 text-xs leading-relaxed text-text-secondary">
            複製される項目：配送方法・送料設定・カテゴリー・返品特約・サイズガイド
            <br />
            複製されない項目：商品名・価格・在庫・画像・商品説明
          </div>

          <div className="mt-7 border-t border-border-subtle pt-6">
            <div className="mb-3.5 flex items-end justify-between">
              <div>
                <h3 className="font-heading text-base">作業中の一時保存</h3>
                <p className="mt-1.5 text-xs text-text-secondary">
                  中断した登録作業の続きから再開できます。保存から30日を過ぎたものは自動で削除されます。
                </p>
              </div>
              <span className="text-xs text-text-secondary">0 件</span>
            </div>
            <div className="overflow-hidden rounded-xl border border-dashed border-border py-8 text-center text-xs text-text-secondary">
              保存された下書きはまだありません（一時保存の保存機能は今後実装予定）
            </div>
          </div>
        </div>
      );

    case 2:
      return (
        <div>
          {eyebrow(2)}
          {title("基本情報")}
          <p className="text-sm text-text-secondary">楽天の商品ページ上部に表示される情報です。</p>
          <div className="mt-5 grid gap-4">
            <Field label="商品名" required hint="38 / 255" defaultValue="綿シフォン ハイネックインナー 2026AW" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="キャッチコピー" defaultValue="秋も、首元を隠して軽やかに。" />
              <Field label="ブランド" defaultValue="LIEN" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="商品管理番号" required defaultValue="5102-AW26" />
              <Field label="品番" defaultValue="5102" />
              <Field label="素材" defaultValue="綿100%" />
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-text-secondary">
                検索キーワード<span className="ml-2 text-text-disabled">スペース区切り・最大10語</span>
              </span>
              <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-surface-elevated p-2.5">
                {["ハイネック", "インナー", "綿100%", "レディース"].map((tag) => (
                  <span key={tag} className="rounded-full bg-accent px-3 py-1.5 text-xs">
                    {tag}
                  </span>
                ))}
                <span className="px-1 py-1.5 text-xs text-text-disabled">＋ キーワードを追加</span>
              </div>
            </label>
          </div>
        </div>
      );

    case 3:
      return (
        <div>
          {eyebrow(3)}
          {title("価格")}
          <p className="text-sm text-text-secondary">
            税込価格で入力します。SKUごとの差額は次の段階で設定できます。
          </p>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="販売価格（税込）" required defaultValue="2680" />
            <Field label="表示用二重価格" defaultValue="2980" />
            <Field label="原価（社内管理）" defaultValue="940" />
          </div>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              ["粗利率", "64.9%"],
              ["1点あたり粗利", "¥1,740"],
              ["同型商品の平均価格", "¥2,680"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-border-subtle bg-surface-hover p-3.5">
                <div className="text-xs text-text-secondary">{label}</div>
                <div className="mt-1.5 font-heading text-xl">{value}</div>
              </div>
            ))}
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 border-t border-border-subtle pt-5 sm:grid-cols-2">
            <SelectField label="ポイント変倍" options={["設定しない", "5倍（期間指定）", "10倍（期間指定）"]} />
            <SelectField
              label="送料"
              options={["送料込み（3,980円以上で送料無料）", "送料別"]}
            />
          </div>
        </div>
      );

    case 4:
      return <SkuStep />;

    case 5:
      return (
        <div>
          {eyebrow(5)}
          {title("商品画像")}
          <p className="text-sm text-text-secondary">
            1枚目がメイン画像です。ドラッグで並べ替えできます。推奨 700×700px 以上。
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="relative flex aspect-square items-center justify-center rounded-xl border border-border bg-gradient-to-br from-[#efe7de] to-[#e4dbd1] text-xs text-text-secondary"
              >
                画像 {n}
                {n === 1 && (
                  <span className="absolute left-2.5 top-2.5 rounded-full bg-primary px-2.5 py-1 text-[10px] text-primary-foreground">
                    メイン
                  </span>
                )}
              </div>
            ))}
            <div className="flex aspect-square flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface-hover text-center text-xs leading-relaxed text-text-secondary">
              ＋<br />
              ドラッグ＆ドロップ
              <br />
              または選択
            </div>
          </div>
          <div className="mt-6 flex items-center justify-between border-t border-border-subtle pt-5 text-sm text-text-secondary">
            <span>3 / 20 枚　白背景チェック 済み・サイズ基準 済み</span>
            <Button variant="outline">色ごとの画像を割り当てる</Button>
          </div>
        </div>
      );

    case 6:
      return (
        <div>
          {eyebrow(6)}
          {title("商品説明")}
          <p className="text-sm text-text-secondary">PC用とスマートフォン用を分けて登録します。</p>
          <div className="mt-5 grid gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="flex justify-between text-xs text-text-secondary">
                <span>
                  スマートフォン用説明文<span className="ml-1.5 text-primary">必須</span>
                </span>
                <span>186 / 1,000</span>
              </span>
              <textarea
                rows={5}
                defaultValue="首元をやさしく覆うハイネック。綿100%の柔らかな肌ざわりで、一枚でも重ね着でも心地よく着られます。透けにくく、日差しの強い季節も安心です。"
                className="w-full resize-none rounded-lg border border-border bg-surface-elevated p-3 text-sm leading-relaxed outline-none focus-visible:border-primary"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-text-secondary">PC用説明文</span>
              <textarea
                rows={6}
                defaultValue={"【素材】綿100%　【生産国】日本\nやさしい肌ざわりの綿シフォンを使用したハイネックインナー。首元を自然に隠し、一枚でも重ね着でも。"}
                className="w-full resize-none rounded-lg border border-border bg-surface-elevated p-3 text-sm leading-relaxed outline-none focus-visible:border-primary"
              />
            </label>
            <div className="rounded-lg border border-border-subtle bg-surface-hover p-4 text-xs leading-relaxed text-text-secondary">
              薬機法・景品表示法に触れる表現は検出されませんでした。禁止タグ（script / iframe）も未使用です。
            </div>
          </div>
        </div>
      );

    case 7:
      return (
        <div>
          {eyebrow(7)}
          {title("配送・カテゴリー")}
          <p className="text-sm text-text-secondary">
            複製元から引き継いだ設定です。変更が必要な項目だけ書き換えてください。
          </p>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField
              label="表示カテゴリー"
              required
              options={[
                "レディースファッション > トップス > インナー",
                "レディースファッション > トップス > カットソー",
              ]}
            />
            <SelectField
              label="配送方法"
              required
              options={["クリックポスト（ポスト投函）", "宅配便（ヤマト運輸）"]}
            />
            <SelectField label="発送目安" options={["1〜2営業日以内に発送", "3〜4営業日以内に発送"]} />
            <Field label="1点あたり重量" defaultValue="180g" />
          </div>
          <div className="mt-5 grid gap-2.5 rounded-lg border border-border-subtle bg-surface-hover p-4 text-sm text-text-secondary">
            <div className="flex justify-between">
              <span>返品特約</span>
              <b className="font-medium text-foreground">お客様都合の返品：商品到着後7日以内</b>
            </div>
            <div className="flex justify-between">
              <span>サイズガイド</span>
              <b className="font-medium text-foreground">LIEN 共通サイズ表（トップス）</b>
            </div>
            <div className="flex justify-between">
              <span>ラッピング</span>
              <b className="font-medium text-foreground">対応可（有料・¥330）</b>
            </div>
          </div>
        </div>
      );

    case 8:
      return (
        <div>
          {eyebrow(8)}
          {title("公開日時")}
          <p className="text-sm text-text-secondary">
            予約すると、指定時刻に自動で楽天へ反映されます。実行前ならいつでも取り消せます。
          </p>
          <div className="mt-5 grid gap-2.5">
            <PublishOption
              active={publish === "draft"}
              title="下書きのまま保存"
              description="楽天には登録しません。あとから公開できます。"
              onClick={() => onSetPublish("draft")}
            />
            <PublishOption
              active={publish === "now"}
              title="すぐに公開"
              description="最終確認のあと、ただちに楽天へ登録します。"
              onClick={() => onSetPublish("now")}
            />
            <PublishOption
              active={publish === "schedule"}
              title="日時を決めて公開予約"
              description="指定した時刻に自動で登録されます。"
              onClick={() => onSetPublish("schedule")}
            />
          </div>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="公開日" defaultValue="2026-09-20" />
            <Field label="時刻" defaultValue="10:00" />
            <Field label="販売終了" defaultValue="設定しない" />
          </div>
          <div className="mt-6 overflow-hidden rounded-xl border border-border-subtle">
            <div className="border-b border-border-subtle bg-surface-hover px-4 py-2.5 text-xs text-text-secondary">
              この商品に登録済みの予約
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div className="flex items-center gap-3.5 text-sm">
                <span className="rounded-full bg-success-subtle px-2.5 py-1 text-xs text-success-foreground">
                  確認済み
                </span>
                <b className="font-medium">9/18 09:00</b>
                <span className="text-text-secondary">説明文とメイン画像を更新</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  内容を見る
                </Button>
                <Button variant="destructive" size="sm">
                  予約を取り消す
                </Button>
              </div>
            </div>
          </div>
        </div>
      );

    case 9:
    default:
      return (
        <div>
          {eyebrow(9)}
          {title("最終確認")}
          <p className="text-sm text-text-secondary">
            この内容で楽天へ登録します。複製元からの変更点を色付きで示しています。
          </p>
          <div className="mt-5 overflow-hidden rounded-xl border border-border">
            <div className="grid grid-cols-[180px_1fr_1fr] bg-surface-hover text-xs text-text-secondary">
              <div className="px-4 py-2.5">項目</div>
              <div className="px-4 py-2.5">複製元（1000000115）</div>
              <div className="px-4 py-2.5">今回登録する内容</div>
            </div>
            {[
              ["商品名", "綿シフォン ハイネックインナー", "綿シフォン ハイネックインナー 2026AW", true],
              ["販売価格", "¥2,680", "¥2,680", false],
              ["SKU / 合計在庫", "9 SKU / 86点", "4 SKU / 48点", true],
              ["画像", "6枚", "3枚", true],
              ["カテゴリー・配送", "インナー / クリックポスト", "インナー / クリックポスト", false],
              ["公開", "公開中", "2026/09/20 10:00 に公開予約", true],
            ].map(([label, before, after, changed]) => (
              <div key={label as string} className="grid grid-cols-[180px_1fr_1fr] border-t border-border-subtle text-sm">
                <div className="px-4 py-3 text-text-secondary">{label}</div>
                <div className="px-4 py-3 text-text-disabled">{before}</div>
                <div className={cn("px-4 py-3", changed && "bg-primary-subtle/40")}>{after}</div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-center gap-3.5 rounded-lg border border-warning-border bg-warning-subtle p-4 text-sm text-text-secondary">
            <span className="text-warning-foreground">！</span>
            登録すると楽天の商品ページが作成され、指定時刻から購入可能になります。取り消しは公開前まで可能です。
          </div>
        </div>
      );
  }
}

function PublishOption({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-start gap-3.5 rounded-xl border p-4 text-left transition-colors",
        active ? "border-primary-border bg-primary-subtle" : "border-border bg-surface-hover"
      )}
    >
      <span
        className={cn(
          "mt-0.5 size-4 shrink-0 rounded-full border",
          active ? "border-primary bg-primary shadow-[inset_0_0_0_3px_var(--surface)]" : "border-border bg-surface"
        )}
      />
      <span>
        <strong className="mb-1 block text-sm">{title}</strong>
        <span className="text-xs text-text-secondary">{description}</span>
      </span>
    </button>
  );
}

function SkuStep() {
  const [rows, setRows] = useState([
    { color: "アイボリー", size: "S", stock: "12", sku: "5102-AW26-IV-S", diff: "±0" },
    { color: "アイボリー", size: "M", stock: "18", sku: "5102-AW26-IV-M", diff: "±0" },
    { color: "ネイビー", size: "M", stock: "12", sku: "5102-AW26-NV-M", diff: "±0" },
    { color: "マスタード", size: "L", stock: "6", sku: "5102-AW26-MU-L", diff: "+200" },
  ]);

  const updateRow = (index: number, key: keyof (typeof rows)[number], value: string) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  };

  const totalStock = rows.reduce((sum, row) => sum + (parseInt(row.stock, 10) || 0), 0);

  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs tracking-wider text-primary">STEP 4 / {TOTAL_STEPS}</div>
          <h2 className="mb-1.5 mt-1.5 font-heading text-2xl">色・サイズ・在庫</h2>
          <p className="text-sm text-text-secondary">1行が1つのSKUです。行を追加して組み合わせを作ります。</p>
        </div>
        <div className="flex items-center gap-2.5 text-sm text-text-secondary">
          <span>
            合計在庫 <b className="font-heading text-lg text-foreground">{totalStock}</b> 点
          </span>
          <span>／</span>
          <span>{rows.length} SKU</span>
        </div>
      </div>

      <div className="mt-4.5 overflow-hidden rounded-xl border border-border">
        <div className="grid grid-cols-[1.2fr_.8fr_.8fr_1.4fr_.9fr_44px] bg-surface-hover text-xs text-text-secondary">
          <div className="px-3.5 py-2.5">色</div>
          <div className="px-3.5 py-2.5">サイズ</div>
          <div className="px-3.5 py-2.5">在庫数</div>
          <div className="px-3.5 py-2.5">SKU番号</div>
          <div className="px-3.5 py-2.5">価格差</div>
          <div />
        </div>
        {rows.map((row, index) => (
          <div
            key={index}
            className="grid grid-cols-[1.2fr_.8fr_.8fr_1.4fr_.9fr_44px] items-center border-t border-border-subtle bg-surface-elevated"
          >
            {(["color", "size", "stock", "sku", "diff"] as const).map((key) => (
              <div key={key} className="px-2 py-2">
                <input
                  value={row[key]}
                  onChange={(e) => updateRow(index, key, e.target.value)}
                  className="w-full rounded-lg border border-border-subtle bg-surface px-2.5 py-2 text-sm outline-none focus-visible:border-primary"
                />
              </div>
            ))}
            <div className="px-1.5 py-2">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                aria-label="行を削除"
              >
                ×
              </Button>
            </div>
          </div>
        ))}
        <div className="flex gap-2.5 bg-surface-hover px-3.5 py-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRows((prev) => [...prev, { color: "", size: "", stock: "0", sku: "5102-AW26-", diff: "±0" }])}
          >
            ＋ SKUを追加
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRows((prev) => [...prev, { ...prev[prev.length - 1] }])}
          >
            最終行を複製
          </Button>
          <span className="ml-auto self-center text-xs text-text-disabled">
            在庫0のSKUは公開時に「売り切れ」と表示されます
          </span>
        </div>
      </div>
    </div>
  );
}
