param([Parameter(Mandatory=$true)][string]$RuntimePath)
$ErrorActionPreference='Stop'
$taskRoot=Split-Path -Parent $PSScriptRoot
$taskRuntime=[IO.Path]::GetFullPath($RuntimePath)
if (-not (Test-Path -LiteralPath (Join-Path $taskRuntime 'bin/Suwayomi-Server.jar')) -or -not (Test-Path -LiteralPath (Join-Path $taskRuntime 'jre/bin/java.exe'))) { throw 'Selecione a edicao portatil oficial Windows x64 do Suwayomi 2.4.2366.' }
$taskJarHash=(Get-FileHash -LiteralPath (Join-Path $taskRuntime 'bin/Suwayomi-Server.jar') -Algorithm SHA256).Hash
if ($taskJarHash -ne 'AF9FEB20AF9D7EBE9E30769E6C6EBC7FC7AB1C447388D42E0280B1DA5FE07BFD') { throw 'O JAR nao corresponde a versao 2.4.2366 fixada e validada neste projeto.' }
$taskTarget=Join-Path $taskRoot 'src-tauri/resources/suwayomi'
New-Item -ItemType Directory -Force -Path $taskTarget | Out-Null
foreach($taskPart in @('bin','jre')) { Copy-Item -LiteralPath (Join-Path $taskRuntime $taskPart) -Destination $taskTarget -Recurse -Force }
Invoke-WebRequest 'https://raw.githubusercontent.com/Suwayomi/Suwayomi-Server/v2.4.2366/LICENSE' -OutFile (Join-Path $taskTarget 'Suwayomi-LICENSE.txt')
@'
Selene includes the unmodified Suwayomi Server 2.4.2366 and its official portable Java runtime.
Suwayomi contributors retain their copyrights. License: Mozilla Public License 2.0.
Corresponding source: https://github.com/Suwayomi/Suwayomi-Server/tree/v2.4.2366
Source archive: https://github.com/Suwayomi/Suwayomi-Server/archive/refs/tags/v2.4.2366.zip
AndroidCompat notices and bundled library notices are retained inside the original JAR.
Java runtime licenses, exceptions and third-party notices are retained under jre/legal.
OpenJDK source: https://github.com/openjdk/jdk25u
Original binary distribution: https://github.com/Suwayomi/Suwayomi-Server/releases/tag/v2.4.2366
The Selene installer does not include third-party manga extensions or repositories.
'@ | Set-Content -LiteralPath (Join-Path $taskTarget 'THIRD-PARTY-NOTICES.txt') -Encoding UTF8
Get-FileHash -LiteralPath (Join-Path $taskTarget 'bin/Suwayomi-Server.jar') -Algorithm SHA256 | Select-Object Hash,Path
