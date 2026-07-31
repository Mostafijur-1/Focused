param(
    [Parameter(Mandatory = $true)][string]$InputDocx,
    [Parameter(Mandatory = $true)][string]$OutputPdf
)

$word = $null
$document = $null
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $document = $word.Documents.Open($InputDocx, $false, $true)
    $document.Repaginate()
    $pages = $document.ComputeStatistics(2)
    $words = $document.ComputeStatistics(0)
    $paragraphs = $document.Paragraphs.Count
    $tables = $document.Tables.Count
    $headings = 0
    foreach ($paragraph in $document.Paragraphs) {
        $styleName = [string]$paragraph.Style
        if ($styleName -like 'Heading *') { $headings++ }
    }
    $document.ExportAsFixedFormat($OutputPdf, 17)
    [PSCustomObject]@{
        Opened = $true
        Pages = $pages
        Words = $words
        Paragraphs = $paragraphs
        Tables = $tables
        Headings = $headings
        PdfExists = (Test-Path -LiteralPath $OutputPdf)
        PdfBytes = if (Test-Path -LiteralPath $OutputPdf) { (Get-Item -LiteralPath $OutputPdf).Length } else { 0 }
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
