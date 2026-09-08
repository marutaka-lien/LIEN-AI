# ダッシュボードC案 ― Claude Design 出力（2026-09-08）

`Shared/決定事項.md` 2026-09-08 で決めた方向「C＝ハイブリッド型」を、`LIENmanager/docs/DASHBOARD_C_DESIGN_BRIEF_2026-09-08.md` を元に Claude Design（デザインキャンバス）で起こしたもの。

## ファイル

- **`今日のオペレーション.dc.html`** ― 本体。1440px の視覚モック（アートボード）。**これが実装の視覚仕様**。
  Claude Design のキャンバス形式（`<x-dc>` / `<sc-if>` / `support.js` ランタイム）なので、**そのままではReact/Next.jsコードにならない**。
  中の インラインスタイル・SVGの座標・状態分岐（`<script type="text/x-dc">` の `renderVals()`）を仕様として読み、実スタックで作り直す。
- `support.js` ― Claude Design のキャンバス編集ランタイム。再編集用。実装では不要。
- `_ds/nocturne-*/` ― Claude Design が自動生成した随伴デザインシステム（アクセント＝blurple `#9184d9`）。
  **実装では使わない**。アートボード本体は LIEN の既存トークン（cyan `#2fc7d4` ほか）で描かれている。実装は `src/app/globals.css` の `.dark` トークンに合わせる。
- `.thumbnail` ― カバー画像。

## モックの状態モデル（`.dc.html` 内の props）

- `mode`: `normal` / `loading` / `empty` / `error`
- `showSuccess`: bool（CSV作成後の成功表示）
- `alertCount`, `csvCount`: 件数を振って表示を確認するための int

派生: `isReady` / `hasAlerts` / `noAlerts`（要確認0件→「確認事項なし」）/ `shipDone`（発送待ち0件→「本日の発送は完了」）/ `ctaEnabled` / `ctaDisabled`（対象0件→ボタン無効＋理由）。

## ブリーフとの差分（実装時に判断）

- セクション名がブリーフと違う: 「実行キュー/EXECUTION」「要対応アラート」「主要指標（現在値）」「出荷パイプライン」「ネクストアクション」「実績モニタリング/MONITORING」「オペレーションログ」。
  既存アプリ・CODEXレポートの語彙（要確認事項／発送パイプライン／最新アクティビティ／次に実行する推奨アクション）と揃えるかは実装時に統一。
- アラート項目のモック内容がブリーフと一部違う（「支払い未確認」追加など）。中身は架空なので問題なし。
- 推移グラフの y 上限が 30 で、発送完了 34 が最上グリッド線を超えて描かれている。実装では y 上限を 36 前後に。

## 次工程

`LIENmanager/docs/CODEX_DASHBOARD_C_IMPLEMENTATION_PROMPT.md` を Codex に渡す → Codex が Gate 1（実装計画）→ グラムが軽い評価パス → 実装。
