param([Parameter(Mandatory=$true)][string]$RuntimePath, [int]$Port=4567, [string]$DataPath)
$ErrorActionPreference='Stop'
if ($Port -lt 1024 -or $Port -gt 65535) { throw 'Escolha uma porta entre 1024 e 65535.' }
$taskRuntime=[System.IO.Path]::GetFullPath($RuntimePath)
$taskJava=Join-Path $taskRuntime 'jre\bin\java.exe'
$taskJar=Join-Path $taskRuntime 'bin\Suwayomi-Server.jar'
if (-not (Test-Path -LiteralPath $taskJava) -or -not (Test-Path -LiteralPath $taskJar)) { throw 'A pasta deve conter jre/bin/java.exe e bin/Suwayomi-Server.jar da edicao portatil.' }
$taskListeners=[System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()
if (@($taskListeners | Where-Object { $_.Port -eq $Port }).Count -gt 0) { throw "A porta $Port ja esta em uso. Confira o Suwayomi aberto." }
$taskData=if ($DataPath) { [System.IO.Path]::GetFullPath($DataPath) } else { Join-Path $env:APPDATA 'YomiSuwayomi' }
# Short per-user socket path avoids overlong temporary paths on Windows.
$taskTemp=Join-Path ([Environment]::GetFolderPath('UserProfile')) '.yomi-sock'
New-Item -ItemType Directory -Force -Path $taskData,$taskTemp | Out-Null
$taskArgs=@(
    "-Djdk.net.unixdomain.tmpdir=$taskTemp",
    "-Djava.io.tmpdir=$taskTemp",
    "-Dsuwayomi.tachidesk.config.server.rootDir=$taskData",
    '-Dsuwayomi.tachidesk.config.server.ip=127.0.0.1',
    "-Dsuwayomi.tachidesk.config.server.port=$Port",
    '-Dsuwayomi.tachidesk.config.server.systemTrayEnabled=false',
    '-Dsuwayomi.tachidesk.config.server.initialOpenInBrowserEnabled=false',
    '-Dsuwayomi.tachidesk.config.server.webUIChannel=BUNDLED',
    '-Dsuwayomi.tachidesk.config.server.webUIUpdateCheckInterval=0',
    '-jar',$taskJar
)
# Start-Process joins arguments; quote every path-bearing argument explicitly.
$taskQuoted=$taskArgs | ForEach-Object { if ($_ -match '"') { throw 'Caminho invalido.' }; '"' + $_ + '"' }
$taskStamp=Get-Date -Format 'yyyyMMdd-HHmmss'
$taskOut=Join-Path $taskData "server-$taskStamp.out.log"
$taskErr=Join-Path $taskData "server-$taskStamp.err.log"
$taskProcess=Start-Process -FilePath $taskJava -ArgumentList $taskQuoted -WorkingDirectory $taskRuntime -WindowStyle Hidden -RedirectStandardOutput $taskOut -RedirectStandardError $taskErr -PassThru
Set-Content -LiteralPath (Join-Path $taskData 'server.pid') -Value $taskProcess.Id
Write-Host "Suwayomi iniciado (PID $($taskProcess.Id)). Abra http://127.0.0.1:$Port"
Write-Host "Dados e logs: $taskData"
Write-Host 'O servidor pode levar alguns segundos para responder. Se nao abrir, confira os logs.'
