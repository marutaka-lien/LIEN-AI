# Fully stops the LIENmanager dev server: disables the auto-restart
# scheduled task and kills the ENTIRE npm/next process tree for this
# project (not just whatever is currently bound to port 3000).
#
# Why not just kill the port-3000 owner: npm run dev spawns a chain
# (npm-cli.js -> next dev -> start-server.js -> turbopack build worker).
# Stop-ScheduledTask only kills the outer wrapper, so any of these can be
# left running as an orphan even when it isn't the one holding the port.
# Two such orphaned trees writing to the same .next cache at once is what
# corrupted the build cache previously (500 errors, ENOENT on
# build-manifest.json).

Stop-ScheduledTask -TaskName "LIENmanager-DevServer" -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# Derive the project root from this script's own location (it lives in
# <root>\scripts\) so the process match keeps working after a drive /
# folder rename of the checkout. Mirrors start-dev-server.ps1.
$ScriptDir = $PSScriptRoot
if (-not $ScriptDir) { $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
$ProjectDir = Split-Path -Parent $ScriptDir

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

Write-Host "LIENmanager dev server stopped ($($ToKill.Count) process(es) killed). Run 'Start-ScheduledTask -TaskName LIENmanager-DevServer' to start it again."
