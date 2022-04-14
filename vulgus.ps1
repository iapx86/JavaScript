#
#	Vulgus
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand vulgus.002) + (expand vulgus.003) + (expand vulgus.004) + (expand vulgus.005) + (expand 1-8n.bin)
$prg2 = expand 1-11c.bin
$fg = expand 1-3d.bin
$bg = (expand 2-2a.bin) + (expand 2-3a.bin) + (expand 2-4a.bin) + (expand 2-5a.bin) + (expand 2-6a.bin) + (expand 2-7a.bin)
$obj = (expand 2-2n.bin) + (expand 2-3n.bin) + (expand 2-4n.bin) + (expand 2-5n.bin)
$red = expand e8.bin
$green = expand e9.bin
$blue = expand e10.bin
$fgcolor = expand d1.bin
$bgcolor = expand c9.bin
$objcolor = expand j2.bin

$rom = $prg1 + $prg2 + $fg + $bg + $obj + $red + $green + $blue + $fgcolor + $bgcolor + $objcolor
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
