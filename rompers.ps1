#
#	Rompers
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$snd = expand rp1_snd0.bin
$prg = (expand rp1_prg4.bin) + (expand rp1_prg5.bin) + (expand rp1prg6b.bin) + (expand rp1prg7b.bin)
$mcu = expand cus64-64a1.mcu
$voi = expand rp_voi-0.bin
$chr8 = expand rp1_chr8.bin
$chr = (expand rp_chr-0.bin) + (expand rp_chr-1.bin) + (expand rp_chr-2.bin) + (expand rp_chr-3.bin)
$obj = (expand rp_obj-0.bin) + (expand rp_obj-1.bin) + (expand rp_obj-2.bin) + (expand rp_obj-3.bin) + (expand rp_obj-4.bin) + (expand rp1_obj5.bin) + (expand rp1_obj6.bin)

$rom = $snd + $prg + $mcu + $voi + $chr8 + $chr + $obj
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
