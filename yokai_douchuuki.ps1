#
#	Yokai Douchuuki
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$snd = (expand yd1_s0.bin) + (expand yd1_s1.bin)
$prg = (expand yd1_p0.bin) + (expand yd1_p1.bin) + (expand yd1_p2.bin) + (expand yd1_p3.bin) + (expand yd1_p5.bin) + (expand youkaidk1/yd1_p6.bin) + (expand youkaidk2/yd2_p7b.bin)
$mcu = expand cus64-64a1.mcu
$voi = (expand yd_voi-0.bin) + (expand yd_voi-1.bin) + (expand yd_voi-2.bin)
$chr8 = expand yd_chr-8.bin
$chr = (expand yd_chr-0.bin) + (expand yd_chr-1.bin) + (expand yd_chr-2.bin) + (expand yd_chr-3.bin) + (expand yd_chr-4.bin) + (expand yd_chr-5.bin) + (expand yd_chr-6.bin) + (expand yd_chr-7.bin)
$obj = (expand yd_obj-0.bin) + (expand yd_obj-1.bin) + (expand yd_obj-2.bin) + (expand yd_obj-3.bin) + (expand yd_obj-4.bin)

$rom = $snd + $prg + $mcu + $voi + $chr8 + $chr + $obj
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
