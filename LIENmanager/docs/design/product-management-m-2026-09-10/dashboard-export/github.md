repo: marutaka-lien/LIEN-AI
branch: main
path: LIENmanager

## Last sync
date: 2026-09-11T02:00:28Z

### Updated in this project
- 商品管理ブリーフ（product-management-m-2026-09-10）を読み込み、実機用の `商品登録.dc.html` を新規作成
- 仮モック preview-v2.html の9段階ウィザードを踏襲。B案テーマ（アイボリー/ベージュ/くすみローズ・Georgia見出し）のトークンを移植
- 安全装置3点: 目次の未入力バッジ／最終確認の複製元との差分表／公開予約の取り消し導線
- 色・サイズ・在庫はSKU行の追加・複製・削除に対応、合計在庫とSKU数が右パネルに連動

### 前回
- 発送ページ集約ブリーフ（2026-09-10）とラフモックREADMEを読み込み、視覚モック `発送エントリー.dc.html` を新規作成
- 色・角丸・フォントは `src/app/globals.css` の `.dark` トークン（cyan基調）から取得。Nocturne(blurple)は不使用
- サイドバー3項目（注文一覧を削除）／2タブ構成／作業メニューを業務フロー順の縦1本に構成
- 状態切替: mode（normal/loading/empty/error）・shippingReportStep（idle/loaded/done）・各件数・selectedCount

## Screen map
| プロジェクト画面 | リポジトリのファイル |
| --- | --- |
| 発送エントリー.dc.html | docs/SHIPPING_PAGE_CONSOLIDATION_BRIEF_2026-09-10.md, docs/design/shipping-page-2026-09-10/README.md, src/app/globals.css, src/components/layout/sidebar.tsx, src/components/layout/top-bar.tsx, src/components/ui/{button,badge,table}.tsx |
| 商品登録.dc.html | docs/design/product-management-m-2026-09-10/{README.md,CLAUDE_DESIGN_HANDOFF.md,preview-v2.html,reference-b-theme.png} |
| 今日のオペレーション.dc.html | docs/DASHBOARD_C_DESIGN_BRIEF_2026-09-08.md, docs/design/dashboard-c-2026-09-08/* |

## Sync history
- 2026-09-10T06:15:30Z — 発送エントリーモックの紐付けを記録
- 2026-09-09T02:57:34Z — ダッシュボードC案モックの紐付けを記録
