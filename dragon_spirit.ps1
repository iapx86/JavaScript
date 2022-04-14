#
#	Dragon Spirit
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$snd = (expand ds1_s0.bin) + (expand ds1_s1.bin)
$prg = (expand ds1_p0.bin) + (expand ds1_p1.bin) + (expand ds1_p2.bin) + (expand ds1_p3.bin) + (expand ds1_p4.bin) + (expand ds1_p5.bin) + (expand ds3_p6.bin) + (expand ds3_p7.bin)
$mcu = expand cus64-64a1.mcu
$voi = (expand ds1_v0.bin) * 2 + (expand ds_voi-1.bin) + (expand ds_voi-2.bin) + (expand ds_voi-3.bin) + (expand ds_voi-4.bin)
$chr8 = expand ds_chr-8.bin
$chr = (expand ds_chr-0.bin) + (expand ds_chr-1.bin) + (expand ds_chr-2.bin) + (expand ds_chr-3.bin) + (expand ds_chr-4.bin) + (expand ds_chr-5.bin) + (expand ds_chr-6.bin) + (expand ds_chr-7.bin)
$obj = (expand ds_obj-0.bin) + (expand ds_obj-1.bin) + (expand ds_obj-2.bin) + (expand ds_obj-3.bin) + (expand ds1_o4.bin) * 2

$rom = $snd + $prg + $mcu + $voi + $chr8 + $chr + $obj
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
