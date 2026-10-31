param([switch]$ReadOnly)
$ErrorActionPreference = 'Stop'
$taskSmokeRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $taskSmokeRoot
. (Join-Path $PSScriptRoot 'BuildEnv.ps1')
$taskTarget = if ($env:CARGO_TARGET_DIR) { $env:CARGO_TARGET_DIR } else { Join-Path $taskSmokeRoot 'src-tauri\target' }
$taskBinary = Join-Path $taskTarget 'release\yomi-reader.exe'
if (-not (Test-Path -LiteralPath $taskBinary)) { throw 'Compile a versao de distribuicao antes de executar o smoke test.' }
if ((Get-Process -Name 'yomi-reader' -ErrorAction SilentlyContinue) -and -not $ReadOnly) { throw 'Feche outras instancias do Yomi Reader antes do smoke test, ou use -ReadOnly.' }
$taskListeners = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()
if (@($taskListeners | Where-Object { $_.Port -eq 9223 }).Count -gt 0) { throw 'A porta local 9223 ja esta em uso. O teste nao foi iniciado.' }
$taskLibrary = [System.IO.Path]::GetFullPath((Join-Path $env:APPDATA 'com.yomi.reader\library'))
$taskFixtureDir = Join-Path $taskLibrary ('smoke-' + [guid]::NewGuid().ToString())
$taskFixtureDir = [System.IO.Path]::GetFullPath($taskFixtureDir)
if (-not $taskFixtureDir.StartsWith($taskLibrary + '\', [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Pasta de teste fora da biblioteca esperada.' }
$taskFixture = Join-Path $taskFixtureDir 'page.png'
$taskSourceImage = Join-Path $taskSmokeRoot 'node_modules\playwright-core\lib\server\chromium\appIcon.png'
if (-not (Test-Path -LiteralPath $taskSourceImage)) { throw 'Icone de teste existente do Playwright nao encontrado.' }
$taskPriorBrowserArgs = $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS
$taskPriorReadOnly = $env:YOMI_SMOKE_READ_ONLY
$taskPriorProfile = $env:WEBVIEW2_USER_DATA_FOLDER
$taskProfile = Join-Path $taskFixtureDir 'webview-profile'
$taskAppProcess = $null
$taskCloseFailed = $false
try {
    New-Item -ItemType Directory -Force -Path $taskFixtureDir | Out-Null
    Copy-Item -LiteralPath $taskSourceImage -Destination $taskFixture
    $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = '--remote-debugging-port=9223'
    $env:YOMI_SMOKE_READ_ONLY = if ($ReadOnly) { '1' } else { '' }
    $env:WEBVIEW2_USER_DATA_FOLDER = $taskProfile
    $taskAppProcess = Start-Process -FilePath $taskBinary -WindowStyle Hidden -RedirectStandardError (Join-Path $taskFixtureDir 'native.log') -PassThru
    & node tests/native-smoke.mjs 'http://127.0.0.1:9223' $taskFixture
    if ($LASTEXITCODE -ne 0) { throw 'O smoke test do aplicativo nativo falhou.' }
} finally {
    $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = $taskPriorBrowserArgs
    $env:YOMI_SMOKE_READ_ONLY = $taskPriorReadOnly
    $env:WEBVIEW2_USER_DATA_FOLDER = $taskPriorProfile
    if ($taskAppProcess -and -not $taskAppProcess.HasExited) {
        $null = $taskAppProcess.CloseMainWindow()
        if (-not $taskAppProcess.WaitForExit(8000)) {
            Stop-Process -Id $taskAppProcess.Id -ErrorAction SilentlyContinue
            $taskCloseFailed = $true
        }
    }
    if (Test-Path -LiteralPath $taskFixture) { Remove-Item -LiteralPath $taskFixture }
    $taskNativeLog = Join-Path $taskFixtureDir 'native.log'
    if (Test-Path -LiteralPath $taskNativeLog) { Get-Content -LiteralPath $taskNativeLog; Remove-Item -LiteralPath $taskNativeLog }
    if (Test-Path -LiteralPath $taskProfile) {
        $taskResolvedProfile = [System.IO.Path]::GetFullPath($taskProfile)
        if (-not $taskResolvedProfile.StartsWith($taskFixtureDir + '\', [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Perfil de teste fora da pasta exclusiva esperada.' }
        for ($taskAttempt=0; $taskAttempt -lt 3; $taskAttempt++) {
            try { Remove-Item -LiteralPath $taskResolvedProfile -Recurse -Force -ErrorAction Stop; break }
            catch { if ($taskAttempt -eq 2) { Write-Warning "Perfil temporario ainda em uso: $taskResolvedProfile" } else { Start-Sleep -Milliseconds 400 } }
        }
    }
    if ((Test-Path -LiteralPath $taskFixtureDir) -and @(Get-ChildItem -LiteralPath $taskFixtureDir -Force).Count -eq 0) { Remove-Item -LiteralPath $taskFixtureDir }
    if ($taskCloseFailed) { throw 'O processo exclusivo do teste nao respondeu ao fechamento normal.' }
}
