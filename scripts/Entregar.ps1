$ErrorActionPreference = 'Stop'
$taskDeliveryRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'BuildEnv.ps1')
$taskTarget = if ($env:CARGO_TARGET_DIR) { $env:CARGO_TARGET_DIR } else { Join-Path $taskDeliveryRoot 'src-tauri\target' }
$taskBundleDir = Join-Path $taskTarget 'release\bundle\nsis'
$taskInstaller = Get-ChildItem -LiteralPath $taskBundleDir -Filter '*-setup.exe' -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $taskInstaller) { throw 'Nenhum instalador encontrado. Execute pnpm desktop:build primeiro.' }
$taskDeliveryDir = Join-Path $taskDeliveryRoot 'entrega'
New-Item -ItemType Directory -Force -Path $taskDeliveryDir | Out-Null
$taskDestination = Join-Path $taskDeliveryDir $taskInstaller.Name
Copy-Item -LiteralPath $taskInstaller.FullName -Destination $taskDestination
$taskHasher = [System.Security.Cryptography.SHA256]::Create()
$taskStream = [System.IO.File]::OpenRead($taskDestination)
try { $taskHash = [System.BitConverter]::ToString($taskHasher.ComputeHash($taskStream)).Replace('-','') }
finally { $taskStream.Dispose(); $taskHasher.Dispose() }
$taskManifest = [ordered]@{ arquivo = $taskInstaller.Name; sha256 = $taskHash; origem = $taskInstaller.FullName }
$taskManifest | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskDeliveryDir 'manifesto.json') -Encoding UTF8
Write-Host "Instalador copiado para: $taskDestination"
Write-Host "SHA256: $taskHash"
