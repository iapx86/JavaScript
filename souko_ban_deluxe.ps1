#
#	Souko Ban Deluxe
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$snd = expand sb1_snd0.bin
$prg = (expand sb1_prg0.bin) + (expand sb1_prg1.bin) + (expand soukobdx/sb1_prg7.bin)
$mcu = expand cus64-64a1.mcu
$voi = (expand sb1_voi0.bin) * 2
$chr8 = expand sb1_chr8.bin
$chr = (expand sb1_chr0.bin) + (expand sb1_chr1.bin) + (expand sb1_chr2.bin) + (expand sb1_chr3.bin)
$obj = expand sb1_obj0.bin

$rom = $snd + $prg + $mcu + $voi + $chr8 + $chr + $obj
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
