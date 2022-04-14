#
#	Mr. HELI no Daibouken
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg = merge ((expand mrheli/mh_c-l0-.ic37) + (expand mrheli/mh_c-l1-.ic36) + (expand mrheli/mh_c-l3-.ic34)) ((expand mrheli/mh_c-h0-.ic40) + (expand mrheli/mh_c-h1-.ic41) + (expand mrheli/mh_c-h3-.ic43))

$rom = $prg
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
