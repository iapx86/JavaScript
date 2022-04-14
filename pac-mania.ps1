#
#	Pac-Mania
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$snd = (expand pacmaniaj/pn1_s0.bin) + (expand pacmaniaj/pn1_s1.bin)
$prg = (expand pn_prg-6.bin) + (expand pacmaniaj/pn1_p7.bin)
$mcu = expand cus64-64a1.mcu
$voi = (expand pacmaniaj/pn1_v0.bin) * 2
$chr8 = expand pn2_c8.bin
$chr = (expand pn_chr-0.bin) + (expand pn_chr-1.bin) + (expand pn_chr-2.bin) + (expand pn_chr-3.bin)
$obj = (expand pn_obj-0.bin) + (expand pacmaniaj/pn_obj-1.bin)

$rom = $snd + $prg + $mcu + $voi + $chr8 + $chr + $obj
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
