# Apply a new Rakuten RMS API license key from a plaintext file into LIENmanager\.env
# (so the secret is never pasted into chat or hand-typed).
#
# Usage (from anywhere):
#   powershell -ExecutionPolicy Bypass -File "C:\lien_AI_manage\LIENmanager\scripts\apply-rms-license-key.ps1"
#
# By default it reads new_license_key.txt one level above the repo folder.
# The old .env is saved as .env.bak. Delete the plaintext key file after it works.

param(
  [string]$KeyFile = (Join-Path $PSScriptRoot '..\..\new_license_key.txt'),
  [string]$EnvFile = (Join-Path $PSScriptRoot '..\.env'),
  [string]$Name    = 'RMS_LICENSE_KEY'
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $KeyFile)) { Write-Error "key file not found: $KeyFile"; exit 1 }
if (-not (Test-Path $EnvFile)) { Write-Error ".env not found: $EnvFile"; exit 1 }

$key = (Get-Content -Raw -Path $KeyFile).Trim()
if ([string]::IsNullOrWhiteSpace($key)) { Write-Error "key file is empty"; exit 1 }
if ($key -match '\s') { Write-Error "key contains whitespace inside it - check the file"; exit 1 }

$lines = Get-Content -Path $EnvFile
if (-not ($lines -match "^$Name=")) { Write-Error "$Name= line not found in .env"; exit 1 }

Copy-Item $EnvFile "$EnvFile.bak" -Force

$updated = $lines | ForEach-Object {
  if ($_ -match "^$Name=") { "$Name=$key" } else { $_ }
}

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllLines($EnvFile, $updated, $utf8NoBom)

Write-Host "OK: $Name updated (length $($key.Length)). Backup: $EnvFile.bak"
Write-Host "Next: restart the dev server, then tell Friday it is done."
