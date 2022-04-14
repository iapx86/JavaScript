#
#	Super Real Mahjong Part 2
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg = merge (expand uco-2.17) (expand uco-3.18)
$gfx = (expand ubo-4.60) + (expand ubo-5.61) + (merge (expand uco-8.64) (expand uco-9.65)) + (expand ubo-6.62) + (expand ubo-7.63) + (merge (expand uco-10.66) (expand uco-11.67))
$voi = expand uco-1.19
$color_h = expand uc-1o.12
$color_l = expand uc-2o.13

$rom = $prg + $gfx + $voi + $color_h + $color_l
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
