#
#	Mahjong Pon Chin Kan
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg = merge ((expand ponchina/u22.bin) + (expand um2_1_2.u29)) ((expand um2_1_3.u42) + (expand um2_1_4.u44))
$gfx = merge ((expand um2_1_8.u55) + (expand um2_1_6.u28)) ((expand um2_1_7.u43) + (expand um2_1_5.u20))
$voi = (expand um2_1_9.u56) + (expand um2_1_10.u63)

$rom = $prg + $gfx + $voi
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
