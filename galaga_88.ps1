#
#	Galaga '88
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$snd = (expand g81_s0.bin) + (expand g81_s1.bin)
$prg = (expand g81_p0.bin) + (expand g81_p1.bin) + (expand g81_p5.bin) + (expand galaga88j/g81_p6.bin) + (expand galaga88j/g81_p7.bin)
$mcu = expand cus64-64a1.mcu
$voi = (expand g81_v0.bin) * 2 + (expand g81_v1.bin) * 2 + (expand g81_v2.bin) * 2 + (expand g81_v3.bin) * 2 + (expand g81_v4.bin) * 2 + (expand g81_v5.bin) * 2
$chr8 = expand g8_chr-8.bin
$chr = (expand g8_chr-0.bin) + (expand g8_chr-1.bin) + (expand g8_chr-2.bin) + (expand g8_chr-3.bin)
$obj = (expand g8_obj-0.bin) + (expand g8_obj-1.bin) + (expand g8_obj-2.bin) + (expand g8_obj-3.bin) + (expand g8_obj-4.bin) + (expand g8_obj-5.bin)

$rom = $snd + $prg + $mcu + $voi + $chr8 + $chr + $obj
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
