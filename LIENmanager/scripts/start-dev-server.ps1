# Keeps LIENmanager's Next.js dev server (npm run dev) running.
# Auto-restarts a few seconds after any crash. Invoked by the
# "LIENmanager-DevServer" scheduled task at user logon.

# Derive the project root from this script's own location instead of a
# hard-coded path, so a drive letter / folder rename of the checkout does
# not break the scheduled task. This script lives in <root>\scripts\.
$ScriptDir = $PSScriptRoot
if (-not $ScriptDir) { $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
$ProjectDir = Split-Path -Parent $ScriptDir

$LogDir = Join-Path $ProjectDir "logs"
$LogFile = Join-Path $LogDir "dev-server.log"
$MaxLogBytes = 20MB

if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir | Out-Null
}

# Without this, Windows PowerShell decodes the npm/node child process's UTF-8
# stdout using the system OEM codepage, garbling the log's Japanese text.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Set-Location $ProjectDir

# One-time cleanup on launch: kill any leftover npm/next process tree for
# this project. Without this, restarting the script (or the scheduled task
# firing again) while an old orphaned tree is still alive results in two
# processes writing to the same .next cache at once, which corrupts it
# (500 errors, "Another write batch or compaction is already active").
# This only walks the tree once at startup - it does not run every loop
# iteration, since during normal operation only this loop ever starts npm.
# Match on the project directory path so the cleanup keeps working after a
# checkout rename.
$AllNode = Get-CimInstance Win32_Process -Filter "Name='node.exe'"
$Matched = $AllNode | Where-Object { $_.CommandLine -and $_.CommandLine -like "*$ProjectDir*" }
$ToKill = @{}
foreach ($p in $Matched) { $ToKill[$p.ProcessId] = $true }
foreach ($p in $Matched) {
    $parentId = $p.ParentProcessId
    while ($parentId) {
        $parent = $AllNode | Where-Object { $_.ProcessId -eq $parentId }
        if (-not $parent) { break }
        $ToKill[$parent.ProcessId] = $true
        $parentId = $parent.ParentProcessId
    }
}
foreach ($procId in $ToKill.Keys) {
    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
}
if ($ToKill.Count -gt 0) {
    Start-Sleep -Seconds 2
}

while ($true) {
    # Rotate the log once instead of letting it grow forever.
    if ((Test-Path $LogFile) -and ((Get-Item $LogFile).Length -gt $MaxLogBytes)) {
        Move-Item -Path $LogFile -Destination "$LogFile.old" -Force
    }

    # Don't start a second copy if a server is already bound to port 3000.
    $portInUse = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
    if ($portInUse) {
        Add-Content -Path $LogFile -Value "$(Get-Date -Format o) [skip] port 3000 already in use" -Encoding utf8
        Start-Sleep -Seconds 300
        continue
    }

    Add-Content -Path $LogFile -Value "$(Get-Date -Format o) [start] npm run dev" -Encoding utf8
    & npm run dev 2>&1 | Out-File -FilePath $LogFile -Append -Encoding utf8
    Add-Content -Path $LogFile -Value "$(Get-Date -Format o) [exit] npm run dev exited (code $LASTEXITCODE) - restarting in 5s" -Encoding utf8
    Start-Sleep -Seconds 5
}
