param(
    [Parameter(Mandatory = $true)][string]$InputDocx
)

$word = $null
$document = $null
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $document = $word.Documents.Open($InputDocx, $false, $false)

    foreach ($section in $document.Sections) {
        foreach ($header in $section.Headers) {
            if ($header.Exists) {
                $header.Range.Text = "FOCUSED | PRODUCTION ARCHITECTURE SPECIFICATION"
                $header.Range.Font.Name = "Arial"
                $header.Range.Font.Size = 8
                $header.Range.Font.Color = 7829367
                $header.Range.ParagraphFormat.Alignment = 1
            }
        }
    }

    foreach ($toc in $document.TablesOfContents) {
        $toc.Update()
    }
    $document.Fields.Update() | Out-Null
    $document.Repaginate()
    $document.Save()

    [PSCustomObject]@{
        Updated = $true
        Sections = $document.Sections.Count
        Pages = $document.ComputeStatistics(2)
    } | ConvertTo-Json -Compress
}
finally {
    if ($document -ne $null) { $document.Close($false) }
    if ($word -ne $null) { $word.Quit() }
    if ($document -ne $null) { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($document) }
    if ($word -ne $null) { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
