$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try {
    Add-Type -AssemblyName System.Runtime.WindowsRuntime
    [Windows.Storage.StorageFile, Windows.Storage, ContentType=WindowsRuntime] | Out-Null
    [Windows.Data.Pdf.PdfDocument, Windows.Data.Pdf, ContentType=WindowsRuntime] | Out-Null
    [Windows.Storage.Streams.IRandomAccessStream, Windows.Storage.Streams, ContentType=WindowsRuntime] | Out-Null
    $operationMethod = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
        $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
    } | Select-Object -First 1
    $actionMethod = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
        $_.Name -eq 'AsTask' -and -not $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction'
    } | Select-Object -First 1
    function Await-Operation($operation, [Type]$resultType) {
        $task = $operationMethod.MakeGenericMethod($resultType).Invoke($null, @($operation))
        $task.GetAwaiter().GetResult()
    }
    # WinRT rejects the extended-length prefix returned by Rust canonicalize.
    $sourcePath = $env:YOMI_PDF_SOURCE
    if ($sourcePath.StartsWith('\\?\UNC\')) { $sourcePath = '\\' + $sourcePath.Substring(8) }
    elseif ($sourcePath.StartsWith('\\?\')) { $sourcePath = $sourcePath.Substring(4) }
    $file = Await-Operation ([Windows.Storage.StorageFile]::GetFileFromPathAsync($sourcePath)) ([Windows.Storage.StorageFile])
    $document = Await-Operation ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($file)) ([Windows.Data.Pdf.PdfDocument])
    if ($document.PageCount -lt 1 -or $document.PageCount -gt 1000) { throw 'PDF_PAGE_LIMIT' }
    $total = 0L
    for ($index = 0; $index -lt $document.PageCount; $index++) {
        $page = $document.GetPage($index)
        $stream = $null
        try {
            $size = $page.Size
            if ($size.Width -le 0 -or $size.Height -le 0) { throw 'PDF_INVALID_SIZE' }
            $scale = 2000.0 / [Math]::Max($size.Width, $size.Height)
            $options = New-Object Windows.Data.Pdf.PdfPageRenderOptions
            $options.DestinationWidth = [uint32][Math]::Max(1, [Math]::Round($size.Width * $scale))
            $options.DestinationHeight = [uint32][Math]::Max(1, [Math]::Round($size.Height * $scale))
            $options.BitmapEncoderId = [Windows.Graphics.Imaging.BitmapEncoder, Windows.Graphics.Imaging, ContentType=WindowsRuntime]::PngEncoderId
            $stream = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
            $task = $actionMethod.Invoke($null, @($page.RenderToStreamAsync($stream, $options)))
            $task.GetAwaiter().GetResult() | Out-Null
            $total += [long]$stream.Size
            if ($stream.Size -eq 0 -or $stream.Size -gt 67108864 -or $total -gt 1073741824) { throw 'PDF_BYTE_LIMIT' }
            $stream.Seek(0)
            $inputStream = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($stream)
            $output = [System.IO.File]::Create((Join-Path $env:YOMI_PDF_TARGET ('{0:D6}.png' -f $index)))
            try { $inputStream.CopyTo($output) } finally { $output.Dispose(); $inputStream.Dispose() }
        } finally { if ($null -ne $stream) { $stream.Dispose() }; $page.Dispose() }
    }
    [Console]::Out.Write($document.PageCount)
    [Environment]::Exit(0)
} catch {
    # Return stable codes only; paths and document diagnostics stay out of logs.
    if ($_.Exception.Message -match 'PDF_PAGE_LIMIT') { [Console]::Out.Write('PDF_PAGE_LIMIT') }
    elseif ($_.Exception.Message -match 'PDF_BYTE_LIMIT') { [Console]::Out.Write('PDF_BYTE_LIMIT') }
    else { [Console]::Out.Write('PDF_RENDER_FAILED') }
    [Environment]::Exit(1)
}
