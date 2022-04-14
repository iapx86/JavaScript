#
#	Super Real Mahjong Part 3
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg = expand za0-10.bin
$gfx = merge ((expand za0-02.bin) + (expand za0-01.bin) + (expand za0-06.bin) + (expand za0-05.bin)) ((expand za0-04.bin) + (expand za0-03.bin) + (expand za0-08.bin) + (expand za0-07.bin))
$voi = expand za0-11.bin
$color_h = expand za0-12.prm
$color_l = expand za0-13.prm

$rom = $prg + $gfx + $voi + $color_h + $color_l
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
