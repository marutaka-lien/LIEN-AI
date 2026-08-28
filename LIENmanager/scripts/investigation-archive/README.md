# 調査専用エンドポイントのアーカイブ

ここにあるファイルは、いずれも元は `src/app/api/**/route.ts` として存在していた
「調査専用の一時エンドポイント(本番機能ではない)」です。UI・他のコードから
一切参照されておらず、任意のURLへ認証済みブラウザ(RMS/ClickPostの永続セッション)を
遷移させてHTML/スクリーンショットを返すという性質上、サーバーを常時稼働させる
運用ではネットワーク上の他端末からも呼び出せてしまうリスクがあったため、
2026-08-06に `src/app/api` の外(このフォルダ)へ移動し、拡張子を`.route.ts.txt`
にして無効化しました。

- `debug-clickpost-screenshot.route.ts.txt` — ClickPostの任意画面のHTML/スクショ取得
- `debug-rms-review-screenshot.route.ts.txt` — RMSレビューチェックツールのCSVダウンロード失敗調査用(リダイレクトチェーン記録)
- `rms-diag-shipping.route.ts.txt` — 特定注文番号(ハードコード)の発送状態調査用
- `clickpost-batch-register.route.ts.txt` — Orchestratorとは別に、複数行まとめ申込を検証するための経路
- `debug-review-reply-reconciliation.route.ts.txt` — replyStatus="unreplied"のレコードが
  実際には楽天公開レビューページ上で返信済みかを棚卸しするdry-run調査用(2026-08-26)。
  他の項目と異なりRMSの認証済みセッションは使わない(対象は認証不要の公開ページ)。
  DBへの書き込みは行わない設計(呼び出し元がapplyReconciliationUpdatesを呼ばない限り
  書き込まれない。src/server/review/review-reply-reconciliation.ts参照)。
- `debug-review-draft-reconciliation.route.ts.txt` — 上記の続き。replyStatus="draft"の
  レコード(AI生成済みの下書きだが自社アプリからは未投稿のはず)についても、同じ
  checkPublicReplyStatusロジックで実際には投稿済みかを棚卸しするdry-run調査用
  (2026-08-26)。DBへの書き込みは一切行わない(読み取り専用エンドポイント)。
  併せてcheckPublicReplyStatusのoptions.includeReplyBody(返信本文そのものを取得する
  技術検証用オプション。既定false)を使うが、本文そのものはレスポンスに含めず件数のみ
  集計する。

再度同種の調査が必要になった場合は、これらを参考にしつつ `src/app/api/` 配下へ
コピーし直して使ってください(そのまま`.route.ts`にリネームして戻せば復元できます)。
