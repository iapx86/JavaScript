#
#	Makai-Mura
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand makaimur/10n.rom) + (expand makaimur/8n.rom) + (expand makaimur/12n.rom)
$prg2 = expand gg2.bin
$fg = expand gg1.bin
$bg = (expand gg11.bin) + (expand gg10.bin) + (expand gg9.bin) + (expand gg8.bin) + (expand gg7.bin) + (expand gg6.bin)
$obj = (expand gngbl/19.84472.4n) + (expand gg16.bin) + (expand gg15.bin) + [Byte[]]@(0xff) * 0x4000 + (expand gngbl/16.84472.4l) + (expand gg13.bin) + (expand gg12.bin) + [Byte[]]@(0xff) * 0x4000

$rom = $prg1 + $prg2 + $fg + $bg + $obj
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
