param(
    [Parameter(Mandatory = $true)][string]$InputDocx,
    [Parameter(Mandatory = $true)][string]$OldText,
    [Parameter(Mandatory = $true)][string]$NewText
)

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$resolvedPath = (Resolve-Path -LiteralPath $InputDocx).Path
$archive = [System.IO.Compression.ZipFile]::Open($resolvedPath, [System.IO.Compression.ZipArchiveMode]::Update)
$updatedEntries = 0

try {
    foreach ($entry in @($archive.Entries | Where-Object { $_.FullName -like 'word/header*.xml' })) {
        $reader = New-Object System.IO.StreamReader($entry.Open())
        try {
            $xml = $reader.ReadToEnd()
        }
        finally {
            $reader.Dispose()
        }

        if (-not $xml.Contains($OldText)) {
            continue
        }

        $replacement = $xml.Replace($OldText, $NewText)
        $entryName = $entry.FullName
        $entry.Delete()
        $newEntry = $archive.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
        $writer = New-Object System.IO.StreamWriter($newEntry.Open(), (New-Object System.Text.UTF8Encoding($false)))
        try {
            $writer.Write($replacement)
        }
        finally {
            $writer.Dispose()
        }
        $updatedEntries++
    }
}
finally {
    $archive.Dispose()
}

[PSCustomObject]@{
    Updated = ($updatedEntries -gt 0)
    HeaderEntries = $updatedEntries
} | ConvertTo-Json -Compress
