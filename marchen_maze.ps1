#
#	Marchen Maze
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$snd = (expand mm_snd-0.bin) + (expand mm_snd-1.bin)
$prg = (expand mm_prg-0.bin) + (expand mm_prg-1.bin) + (expand mm_prg-2.bin) + (expand mm1_p6.bin) + (expand mm1_p7.bin)
$mcu = expand cus64-64a1.mcu
$voi = (expand mm_voi-0.bin) + (expand mm_voi-1.bin)
$chr8 = expand mm_chr-8.bin
$chr = (expand mm_chr-0.bin) + (expand mm_chr-1.bin) + (expand mm_chr-2.bin) + (expand mm_chr-3.bin) + (expand mm_chr-4.bin) + (expand mm_chr-5.bin)
$obj = (expand mm_obj-0.bin) + (expand mm_obj-1.bin) + (expand mm_obj-2.bin) + (expand mm_obj-3.bin)
$nvram = expand mmaze.nv

$rom = $snd + $prg + $mcu + $voi + $chr8 + $chr + $obj + $nvram
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
