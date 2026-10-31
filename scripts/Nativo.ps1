param([ValidateSet('test','build','dev','check','info')][string]$Action = 'test')
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
. (Join-Path $PSScriptRoot 'BuildEnv.ps1')
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) { throw 'Cargo nao encontrado. Consulte PROXIMOS-PASSOS.md ou configure local-build.json.' }
switch ($Action) {
    'test' { & cargo test --manifest-path src-tauri/Cargo.toml --locked }
    'check' { & cargo check --manifest-path src-tauri/Cargo.toml --locked }
    'dev' { & pnpm exec tauri dev }
    'build' { & pnpm exec tauri build }
    'info' { & pnpm exec tauri info }
}
exit $LASTEXITCODE
