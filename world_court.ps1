#
#	World Court
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$snd = expand wc1_snd0.bin
$prg = (expand wc1_prg6.bin) + (expand wc1_prg7.bin)
$mcu = expand cus64-64a1.mcu
$voi = (expand wc1_voi0.bin) * 2 + (expand wc1_voi1.bin)
$chr8 = expand wc1_chr8.bin
$chr = (expand wc1_chr0.bin) + (expand wc1_chr1.bin) + (expand wc1_chr2.bin) + (expand wc1_chr3.bin)
$obj = (expand wc1_obj0.bin) + (expand wc1_obj1.bin) + (expand wc1_obj2.bin) + (expand wc1_obj3.bin) * 2

$rom = $snd + $prg + $mcu + $voi + $chr8 + $chr + $obj
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
