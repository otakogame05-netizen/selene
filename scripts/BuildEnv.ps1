# Optional local paths keep heavy compiler files off the system drive.
# This file changes only the current process environment.
$taskBuildRoot = Split-Path -Parent $PSScriptRoot
$taskBuildConfigPath = Join-Path $taskBuildRoot 'local-build.json'
if (Test-Path -LiteralPath $taskBuildConfigPath) {
    $taskBuildConfig = Get-Content -LiteralPath $taskBuildConfigPath -Raw | ConvertFrom-Json
    foreach ($taskField in @('cargoHome','rustupHome','targetDir','tempDir')) {
        $taskValue = $taskBuildConfig.$taskField
        if ($taskValue -and -not [System.IO.Path]::IsPathRooted([string]$taskValue)) { throw "O campo $taskField deve conter um caminho absoluto em local-build.json." }
    }
    if ($taskBuildConfig.cargoHome) {
        $env:CARGO_HOME = [string]$taskBuildConfig.cargoHome
        $env:PATH = (Join-Path $env:CARGO_HOME 'bin') + ';' + $env:PATH
    }
    if ($taskBuildConfig.rustupHome) { $env:RUSTUP_HOME = [string]$taskBuildConfig.rustupHome }
    if ($taskBuildConfig.targetDir) { $env:CARGO_TARGET_DIR = [string]$taskBuildConfig.targetDir }
    if ($taskBuildConfig.tempDir) { $env:TEMP = [string]$taskBuildConfig.tempDir; $env:TMP = [string]$taskBuildConfig.tempDir }
    if ($taskBuildConfig.jobs) { $env:CARGO_BUILD_JOBS = [string][Math]::Max(1,[Math]::Min(16,[int]$taskBuildConfig.jobs)) }
    if ($taskBuildConfig.lowDebugSymbols) { $env:CARGO_PROFILE_DEV_DEBUG = '0'; $env:CARGO_PROFILE_TEST_DEBUG = '0' }
}
