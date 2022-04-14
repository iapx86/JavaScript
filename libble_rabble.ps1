#
#	Libble Rabble
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand 5b.rom) + (expand 5c.rom)
$prg2 = expand 2c.rom
$prg3 = merge (expand 8c.rom) (expand 10c.rom)
$bg = expand 5p.rom
$obj = expand 9t.rom
$red = expand lr1-3.1r
$green = expand lr1-2.1s
$blue = expand lr1-1.1t
$bgcolor = expand lr1-5.5l
$objcolor = expand lr1-6.2p
$snd = expand lr1-4.3d

$rom = $prg1 + $prg2 + $prg3 + $bg + $obj + $red + $green + $blue + $bgcolor + $objcolor + $snd
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
