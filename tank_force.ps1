#
#	Tank Force
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$snd = expand tf1_snd0.bin
$prg = (expand tf1_prg0.bin) + (expand tf1_prg1.bin) + (expand tankfrcej/tf1_prg7.bin)
$mcu = expand cus64-64a1.mcu
$voi = (expand tf1_voi0.bin) + (expand tf1_voi1.bin)
$chr8 = expand tf1_chr8.bin
$chr = (expand tf1_chr0.bin) + (expand tf1_chr1.bin) + (expand tf1_chr2.bin) + (expand tf1_chr3.bin) + (expand tf1_chr4.bin) + (expand tf1_chr5.bin)
$obj = (expand tf1_obj0.bin) + (expand tf1_obj1.bin)

$rom = $snd + $prg + $mcu + $voi + $chr8 + $chr + $obj
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
