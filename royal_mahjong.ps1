#
#	Royal Mahjong
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg = (expand 1.p1) + (expand 2.p2) + (expand 3.p3) + (expand 4.p4) + (expand 5.p5) + (expand 6.p6)
$rgb = expand 18s030n.6k

$rom = $prg + $rgb
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
