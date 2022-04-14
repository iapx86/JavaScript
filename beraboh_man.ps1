#
#	Beraboh Man
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$snd = expand bm1_s0.bin
$prg = (expand bm1_p0.bin) + (expand bm1_p1.bin) + (expand bm1_p4.bin) + (expand bm1-p6.bin) + (expand bm1_p7c.bin)
$mcu = expand cus64-64a1.mcu
$voi = (expand bm1_v0.bin) * 2 + (expand bm_voi-1.bin) + (expand bm1_v2.bin) * 2
$chr8 = expand bm_chr-8.bin
$chr = (expand bm_chr-0.bin) + (expand bm_chr-1.bin) + (expand bm_chr-2.bin) + (expand bm_chr-3.bin) + (expand bm_chr-4.bin) + (expand bm_chr-5.bin) + (expand bm_chr-6.bin)
$obj = (expand bm_obj-0.bin) + (expand bm_obj-1.bin) + (expand bm_obj-2.bin) + (expand bm_obj-3.bin) + (expand bm_obj-4.bin) + (expand bm_obj-5.bin) + [Byte[]]@(0xff) * 0x20000 + (expand bm_obj-7.bin)

$rom = $snd + $prg + $mcu + $voi + $chr8 + $chr + $obj
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
