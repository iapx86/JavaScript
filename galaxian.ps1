#
#	Galaxian
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg = (expand galap1/7f.bin) + (expand galaxiana/7j.bin) + (expand galaxiana/7l.bin)
$bg = (expand 1h.bin) + (expand 1k.bin)
$rgb = expand 6l.bpr

$rom = $prg + $bg + $rgb
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
