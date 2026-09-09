# ダッシュボード「今日のオペレーション」C案の実装

> **2026-09-09 更新**: マスター指示で Codex の評価・実装は取りやめ、**担当をグラムに変更**。
> あわせて2点変更 ―
> (1) 下記「進め方（Gate方式）」の Gate 1（計画提出＋マスター確認の往復）は**スキップ**。実装 → 自己チェック → マスターへ結果報告 → 承認後コミット。
> (2)「本日の処理推移」グラフは**既存データの範囲で作る／DB追加なし**（`OperationalSnapshot` 等の新設はしない）。
> グラム向けの手順は `Gram/課題_ダッシュボードC案の実装_2026-09-09.md`。以下の本文（技術仕様）はそのまま有効。

---

## 依頼

`src/app/dashboard/page.tsx`（現「今日のオペレーション」）を、決定済みのC案（ハイブリッド型）へ作り直す。プロジェクトF Phase 2。

- 参照（すべてリポジトリ内）:
  - **まず開く（表示確認用）**: `docs/design/dashboard-c-2026-09-08/preview.html` ― `.dc.html` を外部ランタイム無しでブラウザ表示できる形にした静的版。右上のコントロールで normal / loading / empty / error / 成功 を切り替え可。
  - 視覚仕様（正）: `docs/design/dashboard-c-2026-09-08/今日のオペレーション.dc.html` ＋ 同フォルダ `README.md`
  - 設計ブリーフ: `docs/DASHBOARD_C_DESIGN_BRIEF_2026-09-08.md`
  - UX方針: `docs/CODEX_UI_UX_REPORT.md`（§4 目指すUX、§5 第2段階、§8 Phase 2、§9 デザインルール）
  - 方向性モック3案（架空データ）: <https://claude.ai/code/artifact/369dd3bf-f1d9-4c29-bdde-4b972f1a38fd>
- 個人情報はチャット・ログ・コミットに出さない。

## 進め方（Gate 方式）

1. **Gate 1（計画のみ・コード変更なし）**: 下記を1枚にまとめて提出。
   - 触るファイル一覧と新規コンポーネント構成
   - データの入手元（既存で取れるもの／新規APIが要るもの）の切り分け
   - 「本日の処理推移」集計APIの設計案（下記参照）
   - 既存テストへの影響、工数見積り
   - → マスター確認後に Gate 2（実装）。
2. Gate 2 実装後、グラムが軽い評価パスを1回。
3. コミット/プッシュはマスター承認後（フライデー経由で可否確認）。

## 視覚仕様の扱い

`.dc.html` は Claude Design のキャンバス形式（`<x-dc>` / `<sc-if>` / `support.js`）。**そのまま移植しない**。
中の レイアウト・インラインスタイル・SVG座標・状態分岐（`<script type="text/x-dc">` の `renderVals()`）を**仕様として読み**、実スタック（Next.js App Router / React 19 / Tailwind v4 / base-ui + shadcn ベース）で作り直す。

- **デザインシステム**: `_ds/nocturne-*/` は使わない。色・間隔・角丸・影・フォントはすべて `src/app/globals.css` の `.dark` トークン（`var(--surface)` `var(--surface-elevated)` `var(--border-subtle)` `var(--border-strong)` `var(--text-secondary)` `var(--primary)` `var(--primary-hover)` `var(--primary-subtle)` `var(--accent-cyan)` `var(--success-foreground)` `var(--warning-foreground)` `var(--error-foreground)` `var(--status-skipped)` `--radius` ほか）から取る。生 hex を新規に置かない。
- アプリはダーク固定（`forcedTheme="dark"`）。ライトは不要。
- インラインスタイルはやめて Tailwind クラス / トークンに置き換える。
- アイコンは既存同様 `lucide-react`（`.dc.html` の Phosphor 指定は無視）。

## レイアウト（C案・`.dc.html` 準拠）

上部: `PageHeader`（既存流用可）。左＝ページ名「今日のオペレーション」、右＝時刻・日付・「稼働中」ドット（`prefers-reduced-motion` で点滅停止）。画面内に常時「MOCK（架空データ）」表示は、**実データ接続前の暫定表示**として置き、実データ接続後は外す。

本体＝2カラム（`lg` 以上で左右、`md` 以下で縦積み）。左 58% / 右 42%、間に `--border-subtle` の縦罫。

### 左「作業」（上から）

1. **要確認事項**（`.dc` 名「要対応アラート」）: `--warning` 系の左3px＋淡背景パネル。見出しに件数。各行＝内容 / 件数 / 注文番号末尾 / 「確認する →」。**0件時＝`--success` 系の落ち着いた「確認事項なし」**。
2. **主要指標（現在値）** 2×2: 発送待ち / CSV未出力 / 本日発送済み / レビュー未返信。ラベル（等幅）＋大数値（等幅・tabular）＋一言メタ＋リンク。色ドット＋必ず文字ラベル。既存 `KPICard` は指標が違うので流用より新規 `MetricTile` 推奨。
3. **発送パイプライン**: 受注確認 → 発送待ち → CSV出力済 → 発送完了 の4段。段階名＋件数を常時表示。同じ幅で比較し、**滞留段を1つだけ `--warning` で強調**（「滞留」チップ）。下に注記「同じ幅で比較。滞留＝〇〇」。※現在値の並置であってファネルではない。
4. **次に実行する推奨アクション**（`.dc` 名「ネクストアクション」）: 左カラム下端。`--primary-subtle` 寄りの持ち上げカード。文＋**プライマリボタン1つ**（`--primary` 塗り。既存 `page.tsx` の CTA と同じ質感）＋補助リンク2本。対象0件＝ボタン `disabled`（不透明度＋理由一言）。実行後＝`--success` の短い確認（チェック＋メッセージ＋DLリンク）。

### 右「把握」（上から）

1. **本日の処理推移**: 折れ線（高さ ~210）。2本＝発送完了累計（実線・`--success` 寄り＋薄い塗り）／受注累計（点線・`--accent-cyan`）。x=9–16時、y上限は 36 前後（`.dc` は 30 で 34 が線を超えている。直すこと）。13:00 に締切目安の縦破線（`--warning`・ラベル）。エラーは別形状マーカー（`--error`・三角）＋下に注記「13:00 CSV文字化け 1件（…〇〇）」。端点に直接ラベル（発送34／受注33）。凡例必須（線種の違いも）。タイトル行に「累計 / 9:00–16:00 / 件数」。SVGは自前（`src/server/integrations/rms-shipping-report` の描画とは別、`components/dashboard/` にSVGコンポーネントとして）。ライブラリ追加不可。
2. **最新アクティビティ**（`.dc` 名「オペレーションログ」）: 時刻（等幅）＋内容、5行＋「すべて表示 →」。警告行は `--warning` 文字色。
3. 空状態: 発送待ち0件＝「本日の発送は完了」。

## 状態設計（`.dc` の props モデルに対応）

各ブロックで **loading / empty / error** を実装。
- loading: スケルトン（数値・行・グラフ枠）。ブランク/無限スピナー禁止。
- error: グラフ集計の取得失敗＝「読み込めませんでした」＋**原因＋次の操作**＋再試行。
- empty: 上記の各空状態。
- CTA成功: `showSuccess` 相当。

## データ

**原則: 実データが取れるものは繋ぐ。取れないものは loading/empty のまま出し、値を捏造しない。**

既存で取れる（サービス/リポジトリを確認して繋ぐ）:
- 発送待ち件数・CSV未出力件数: `src/server/order/order.repository.ts`（`findMany` の `pendingOnly`、`findCsvExportTargetOrders`、`getTodayCsvExportSummary`）。
- 発送完了報告の本日実績: `order.repository.ts` の `getTodayShippingReportSummary`。
- レビュー未返信: `src/server/review/*`（`replyStatus="unreplied"`）。
- 自動化ジョブ状況・最新ジョブ: `src/server/automation/automation-job.service.ts` の `getDashboardSummary`（アクティビティの一部に流用可）。
- 発送パイプラインの各段: 上記の組み合わせ（受注確認待ち=orderStatus 100、発送待ち=300、CSV出力済=300かつcsvExportedAt有、発送完了=本日 shippingReportedAt 有 等）。定義は Gate 1 で明記。

新規が要る:
- **本日の処理推移（時間帯別の受注累計・発送完了累計）**: 現状スキーマから当日の時系列は再現できない可能性。CODEX §6 の方針どおり、まず既存 `Order.orderedAt` / `shippingReportedAt` / `csvExportedAt` から算出できる範囲で実装し、足りなければ `OperationalSnapshot` 的な集計テーブルの追加を Gate 1 で提案（DB追加はマスター判断）。
- **要確認事項の集約**: CSV文字化け警告・住所不備・同一宛先の複数注文 等の横断リスト。既存の警告ソース（clickpost-charset の検知、shipping-report の needsReview 等）を1本にまとめる集約関数を新設。
- グラフ用集計API 1本（`src/app/api/dashboard/...`）。

## 守る / やらない（CODEX §9）

守る: 1画面のプライマリCTAは1つ ／ 現在値と過去分析を同格に混ぜない（ゾーン分離を維持）／ 状態は色だけに頼らずアイコン＋文字 ／ ホバー無しで重要情報と操作に到達 ／ `prefers-reduced-motion` 尊重・動きは1〜2箇所 ／ グラフに目的・期間・単位・母数 ／ 見出し階層 h1→h2→h3 ／ フォーカスリングを消さない。

やらない: 円グラフ ／ 装飾だけのグラフ ／ 根拠のないAI評価・予測 ／ ライトテーマ ／ 外部フォント・チャートライブラリの追加 ／ 締切超過を赤い「遅延」で煽る表現。

## 完了条件

- `npm run build` 成功、`npx tsc --noEmit` は本変更ぶんクリーン、`eslint` エラーなし。
- `npm run test` は既存比で悪化なし（`main` に元からある失敗3件＝RMSブラウザ操作テストは対象外）。
- デスクトップ1440pxで `.dc.html` と情報構造が一致。`md` 以下で縦積みに破綻なく落ちる（モバイル最適化＝A案の縦積み方向は別タスク、今回は「崩れない」まで）。
- loading / empty / error / disabled / success が各ブロックで確認できる。
