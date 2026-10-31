param([switch]$SalvarRelatorio)

$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'BuildEnv.ps1')
$taskChecks = [System.Collections.Generic.List[object]]::new()

function Add-Check([string]$Name, [bool]$Ready, [string]$Detail, [string]$Action) {
    $taskChecks.Add([pscustomobject]@{ requisito = $Name; pronto = $Ready; detalhe = $Detail; proximoPasso = $Action })
    $taskStatus = if ($Ready) { 'OK' } else { 'FALTA' }
    Write-Host "[$taskStatus] $Name - $Detail"
    if (-not $Ready) { Write-Host "        $Action" }
}

$taskNode = Get-Command node -ErrorAction SilentlyContinue
$taskNodeVersion = if ($taskNode) { (& node --version | Out-String).Trim() } else { '' }
$taskNodeReady = $false
if ($taskNodeVersion -match '^v(\d+)\.') { $taskNodeReady = [int]$Matches[1] -ge 24 }
Add-Check 'Node.js 24 ou superior' $taskNodeReady $taskNodeVersion 'Instale o Node.js LTS em https://nodejs.org/ e reabra o terminal.'

$taskPnpm = Get-Command pnpm -ErrorAction SilentlyContinue
$taskPnpmVersion = if ($taskPnpm) { (& pnpm --version | Out-String).Trim() } else { '' }
Add-Check 'pnpm 11.25.0' ($taskPnpmVersion -eq '11.25.0') $taskPnpmVersion 'Com Node instalado, execute: npm install -g pnpm@11.25.0'

$taskCargo = Get-Command cargo -ErrorAction SilentlyContinue
$taskRust = Get-Command rustc -ErrorAction SilentlyContinue
$taskRustVersion = if ($taskRust) { (& rustc --version | Out-String).Trim() } else { 'Nao encontrado' }
Add-Check 'Rust e Cargo' ([bool]$taskCargo -and [bool]$taskRust) $taskRustVersion 'Instale Rust por https://rustup.rs/ e reabra o terminal.'

$taskRustup = Get-Command rustup -ErrorAction SilentlyContinue
$taskTargetReady = $false
$taskTargets = ''
if ($taskRustup) {
    $taskTargets = (& rustup target list --installed | Out-String).Trim()
    $taskTargetReady = $taskTargets -match '(?m)^x86_64-pc-windows-msvc\s*$'
}
Add-Check 'Alvo Rust Windows x64 MSVC' $taskTargetReady $taskTargets 'Execute: rustup default stable-msvc; rustup target add x86_64-pc-windows-msvc'

$taskPrograms = ${env:ProgramFiles(x86)}
$taskVswhere = if ($taskPrograms) { Join-Path $taskPrograms 'Microsoft Visual Studio\Installer\vswhere.exe' } else { '' }
$taskMsvcPath = ''
if ($taskVswhere -and (Test-Path -LiteralPath $taskVswhere)) {
    $taskMsvcPath = (& $taskVswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath | Out-String).Trim()
}
Add-Check 'Compilador C++ MSVC x64/x86' (-not [string]::IsNullOrWhiteSpace($taskMsvcPath)) $taskMsvcPath 'Instale Visual Studio Build Tools com Desenvolvimento para desktop com C++: https://visualstudio.microsoft.com/visual-cpp-build-tools/'

$taskKitsRoot = ''
try { $taskKitsRoot = (Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Microsoft\Windows Kits\Installed Roots').KitsRoot10 } catch {}
if (-not $taskKitsRoot -and $taskPrograms) { $taskKitsRoot = Join-Path $taskPrograms 'Windows Kits\10' }
$taskSdkVersion = ''
if ($taskKitsRoot -and (Test-Path -LiteralPath (Join-Path $taskKitsRoot 'Include'))) {
    foreach ($taskInclude in Get-ChildItem -LiteralPath (Join-Path $taskKitsRoot 'Include') -Directory) {
        $taskHeader = Join-Path $taskInclude.FullName 'um\Windows.h'
        $taskLib = Join-Path $taskKitsRoot ("Lib\{0}\um\x64\kernel32.lib" -f $taskInclude.Name)
        $taskUcrt = Join-Path $taskKitsRoot ("Lib\{0}\ucrt\x64\ucrt.lib" -f $taskInclude.Name)
        if ((Test-Path -LiteralPath $taskHeader) -and (Test-Path -LiteralPath $taskLib) -and (Test-Path -LiteralPath $taskUcrt)) { $taskSdkVersion = $taskInclude.Name }
    }
}
Add-Check 'Windows SDK para x64' (-not [string]::IsNullOrWhiteSpace($taskSdkVersion)) $taskSdkVersion 'No Visual Studio Installer, inclua um Windows 10/11 SDK no conjunto C++.'

$taskWebviewPaths = @()
if ($taskPrograms) { $taskWebviewPaths += (Join-Path $taskPrograms 'Microsoft\EdgeWebView\Application') }
if ($env:LOCALAPPDATA) { $taskWebviewPaths += (Join-Path $env:LOCALAPPDATA 'Microsoft\EdgeWebView\Application') }
$taskWebviewVersion = ''
foreach ($taskWebviewPath in $taskWebviewPaths) {
    if (Test-Path -LiteralPath $taskWebviewPath) {
        foreach ($taskVersion in Get-ChildItem -LiteralPath $taskWebviewPath -Directory) {
            if (Test-Path -LiteralPath (Join-Path $taskVersion.FullName 'msedgewebview2.exe')) { $taskWebviewVersion = $taskVersion.Name }
        }
    }
}
Add-Check 'WebView2 Runtime' (-not [string]::IsNullOrWhiteSpace($taskWebviewVersion)) $taskWebviewVersion 'Se nao estiver instalado, obtenha o Evergreen Runtime em https://developer.microsoft.com/microsoft-edge/webview2/'

if ($SalvarRelatorio) {
    $taskReport = Join-Path $taskRoot 'diagnostico-windows.json'
    $taskChecks | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath $taskReport -Encoding UTF8
    Write-Host "Relatorio salvo em: $taskReport"
}
$taskMissing = @($taskChecks | Where-Object { -not $_.pronto })
Write-Host ''
if ($taskMissing.Count -gt 0) {
    Write-Host 'O aplicativo nativo ainda precisa dos requisitos acima. A previa da interface pode ser aberta com pnpm dev.'
    exit 1
}
Write-Host 'Requisitos detectados. Execute pnpm test:rust e pnpm desktop para validar o aplicativo nativo.'
Write-Host 'Este diagnostico nao substitui uma compilacao bem-sucedida.'
exit 0
