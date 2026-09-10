# 発送ページ集約 ― Claude Design 出力（2026-09-10）

`docs/SHIPPING_PAGE_CONSOLIDATION_BRIEF_2026-09-10.md` ＋ 手組みラフモックを元に Claude Design で起こしたもの。
zip（`ダークコックピットダッシュボード設計.zip`）を展開して取り込んだ。

## ファイル

| ファイル | 内容 | 採否 |
|---|---|---|
| **`発送エントリー v2.dc.html`** | 発送エントリーのコンパクト案。確認待ち/未処理/作業中/処理済み/一時保存 の**セグメント切替**＋右側に アクション枠 / 取込プレビュー / 警告 / 本日の履歴。 | **★採用（2026-09-10 マスター決定）** |
| `発送エントリー.dc.html` | 同じ画面のフル案（ブリーフ準拠・縦1本）。 | 不採用（参考） |
| `今日のオペレーション.dc.html` | ダッシュボード。`docs/design/dashboard-c-2026-09-08/` の既存モックと**バイト単位で同一**（再同梱されただけ）。 | 変更なし・対象外 |
| `support.js` | Claude Design キャンバスのランタイム。再編集用。実装では不要。 | ― |
| `_ds/nocturne-*/` | Claude Design 付属のデザインシステム（紫＝blurple `#9184d9`）。 | **使わない**。モック本体は既存 `.dark`（cyan）トークンで描かれている |
| `.thumbnail` / `github.md` | カバー画像 / 同期メタ。 | ― |

## 実装時の構成（2026-09-10 マスター決定）

v2 には「注文者情報一覧」タブが無いため、**発送エントリーを上部2タブにする**:

- **タブ1「作業メニュー」= v2 の中身そのまま**（セグメント切替＋右アサイド）。
- **タブ2「注文者情報一覧」= 全ステータスの表**（RMS相違確認・過去検索。旧 `/orders` の `OrderListTable` を流用し、v2 のトーンでグラムが新規作成）。
- 旧 `/orders` ルートとサイドバーの「注文一覧」項目は削除。

## v2 が使っている独自トークン → 実トークンの対応（実装で置き換え）

v2 は `--line` `--line2` `--panel` `--panel2` `--panel3` `--ink` `--ink2`〜`--ink4` `--primary` `--primary-soft`
`--primary-line` `--on-primary` などの名前を使っている。これは `src/app/globals.css` の `.dark` の
`--border-subtle` `--border-strong` `--surface` `--surface-elevated` `--surface-hover` `--foreground`
`--text-secondary` `--muted-foreground` `--text-disabled` `--primary` `--primary-subtle` `--primary-border`
`--primary-foreground` に対応させる（色は同じ oklch 値を指しているので、名前だけ既存トークンへ）。

## 次工程

`Gram/課題_発送ページ集約の実装_2026-09-10.md` を参照。
