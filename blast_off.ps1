#
#	Blast Off
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$snd = (expand bo1-snd0.bin) + (expand bo1-snd1.bin)
$prg = (expand bo1_prg6.bin) + (expand bo1prg7b.bin)
$mcu = expand cus64-64a1.mcu
$voi = (expand bo_voi-0.bin) + (expand bo_voi-1.bin) + (expand bo_voi-2.bin)
$chr8 = expand bo_chr-8.bin
$chr = (expand bo_chr-0.bin) + (expand bo_chr-1.bin) + (expand bo_chr-2.bin) + (expand bo_chr-3.bin) + (expand bo_chr-4.bin) + (expand bo_chr-5.bin) + [Byte[]]@(0xff) * 0x20000 + (expand bo_chr-7.bin)
$obj = (expand bo_obj-0.bin) + (expand bo_obj-1.bin) + (expand bo_obj-2.bin) + (expand bo_obj-3.bin) + (expand bo1_obj4.bin)

$rom = $snd + $prg + $mcu + $voi + $chr8 + $chr + $obj
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
