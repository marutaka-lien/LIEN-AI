# LIENmanager

楽天RMS × ClickPost の発送・レビュー対応を自動化するNext.jsアプリ。

## 開発サーバー

`scripts/start-dev-server.ps1` がWindowsログイン時にタスクスケジューラ経由で
自動起動し、`http://localhost:3000` を常時維持しています。手動で起動・停止する
場合は以下を使ってください。

```powershell
Start-ScheduledTask -TaskName "LIENmanager-DevServer"
.\scripts\stop-dev-server.ps1
```

ログは `logs/dev-server.log` に出力されます。

## 主な機能

- クリックポスト発送エントリー(楽天RMS発送待ち注文→ClickPostまとめ申込登録の自動化)
- 発送待ち注文者のCSV作成(ClickPostへドラッグ&ドロップできる形式で手動出力)
- レビュー同期・自動返信(開発中)

## その他

- CodexによるUI/UX改善内容と今後の提案: [`docs/CODEX_UI_UX_REPORT.md`](docs/CODEX_UI_UX_REPORT.md)
- `scripts/investigation-archive/` — 過去の調査専用エンドポイントのアーカイブ(本番では無効化済み)
- テスト: `npm test` / Lint: `npm run lint`
