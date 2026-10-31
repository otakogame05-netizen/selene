param([switch]$BasicAuth)
$ErrorActionPreference='Stop'
$taskWorkspace=Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $taskWorkspace
. (Join-Path $PSScriptRoot 'BuildEnv.ps1')
$taskTarget=if($env:CARGO_TARGET_DIR){$env:CARGO_TARGET_DIR}else{Join-Path $taskWorkspace 'src-tauri\target'}
$taskBinary=Join-Path $taskTarget 'release\yomi-reader.exe'
if(-not(Test-Path -LiteralPath $taskBinary)){throw 'Compile a versao de distribuicao primeiro.'}
$taskListeners=[System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()
if(@($taskListeners|Where-Object{$_.Port -eq 9224}).Count){throw 'A porta de teste 9224 esta ocupada.'}
$taskBase=[System.IO.Path]::GetFullPath((Join-Path $taskWorkspace '.test-results'))
$taskRoot=[System.IO.Path]::GetFullPath((Join-Path $taskBase ('recovery-'+[guid]::NewGuid())))
if(-not $taskRoot.StartsWith($taskBase+'\',[System.StringComparison]::OrdinalIgnoreCase)){throw 'Pasta de teste fora do local esperado.'}
New-Item -ItemType Directory -Force -Path $taskRoot|Out-Null
$taskPreviousAuth=$env:YOMI_TEST_BASIC_AUTH
try{$env:YOMI_TEST_BASIC_AUTH=if($BasicAuth){'1'}else{''};& node tests/native-recovery.mjs $taskBinary $taskRoot;$taskResult=$LASTEXITCODE}finally{$env:YOMI_TEST_BASIC_AUTH=$taskPreviousAuth}
if($taskResult -ne 0){throw "Teste falhou. Dados isolados e logs preservados em: $taskRoot"}
$taskReport=if($BasicAuth){'latest-basic-auth.json'}else{'latest-recovery.json'}
Copy-Item -LiteralPath (Join-Path $taskRoot 'result.json') -Destination (Join-Path $taskBase $taskReport)
# Only this test's verified, generated directory is removed; never user app data.
$taskResolved=[System.IO.Path]::GetFullPath($taskRoot)
if(-not $taskResolved.StartsWith($taskBase+'\',[System.StringComparison]::OrdinalIgnoreCase)){throw 'Limpeza fora da pasta exclusiva de teste.'}
Remove-Item -LiteralPath $taskResolved -Recurse -Force
Get-Content -LiteralPath (Join-Path $taskBase $taskReport)
