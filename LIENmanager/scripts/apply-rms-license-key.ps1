<#
  新しい楽天RMS APIライセンスキーを平文ファイルから読み取り、LIENmanager\.env の
  RMS_LICENSE_KEY 行へ書き込む。キーをチャットに貼らず・手打ちせずに更新するための補助。

  使い方（LIENmanager フォルダで）:
    powershell -ExecutionPolicy Bypass -File scripts\apply-rms-license-key.ps1

  既定では 1つ上の階層の new_license_key.txt を読む。別の場所なら -KeyFile で指定。
  更新前の .env は .env.bak として退避する。実行後はキー平文ファイルを削除すること。
#>
param(
  [string]$KeyFile = (Join-Path $PSScriptRoot '..\..\new_license_key.txt'),
  [string]$EnvFile = (Join-Path $PSScriptRoot '..\.env'),
  [string]$Name    = 'RMS_LICENSE_KEY'
)
$ErrorActionPreference = 'Stop'

if (-not (Test-Path $KeyFile)) { Write-Error "キーのファイルが見つかりません: $KeyFile"; exit 1 }
if (-not (Test-Path $EnvFile)) { Write-Error ".env が見つかりません: $EnvFile"; exit 1 }

$key = (Get-Content -Raw -Path $KeyFile).Trim()
if ([string]::IsNullOrWhiteSpace($key) -or $key -match '\s') {
  Write-Error "キーの中身が不正です（空、または途中に空白・改行がある）。ファイルを確認してください。"
  exit 1
}

$lines = Get-Content -Path $EnvFile
if (-not ($lines -match "^$Name=")) { Write-Error ".env に $Name= の行が見つかりません"; exit 1 }

Copy-Item $EnvFile "$EnvFile.bak" -Force
$updated = $lines | ForEach-Object { if ($_ -match "^$Name=") { "$Name=$key" } else { $_ } }

# 日本語コメント行を壊さないよう UTF-8 (BOMなし) で書き戻す。
[System.IO.File]::WriteAllLines($EnvFile, $updated, (New-Object System.Text.UTF8Encoding $false))

Write-Host "OK: $Name を更新しました（長さ $($key.Length)）。退避: $EnvFile.bak"
Write-Host "次: 開発サーバーを再起動 → scripts\stop-dev-server.ps1 の後 scripts\start-dev-server.ps1"
Write-Host "その後フライデーへ「更新して再起動した」と連絡。確認後、new_license_key.txt は削除してください。"
