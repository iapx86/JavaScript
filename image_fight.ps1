#
#	Image Fight
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg = merge ((expand imgfightb/ic89.7b) + (expand if-c-l3.ic34)) ((expand imgfightb/ic108.9b) + (expand if-c-h3.ic43))

$rom = $prg
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
