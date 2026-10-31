$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
. (Join-Path $PSScriptRoot 'BuildEnv.ps1')
foreach ($tool in @('node', 'pnpm', 'cargo', 'rustc')) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        Write-Host "Ferramenta ausente: $tool. Consulte a secao Como executar no README.md."
        exit 1
    }
}
if (-not (Test-Path -LiteralPath 'node_modules')) {
    & pnpm install --frozen-lockfile
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
& pnpm desktop
exit $LASTEXITCODE
