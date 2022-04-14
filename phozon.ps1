#
#	Phozon
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand 6e.rom) + (expand 6h.rom) + (expand 6c.rom) + (expand 6d.rom)
$prg2 = expand 3b.rom
$prg3 = expand 9r.rom
$bg = (expand 7j.rom) + (expand 8j.rom)
$obj = expand 5t.rom
$red = expand red.prm
$green = expand green.prm
$blue = expand blue.prm
$bgcolor = expand chr.prm
$objcolor = expand sprite.prm
$snd = expand sound.prm

$rom = $prg1 + $prg2 + $prg3 + $bg + $obj + $red + $green + $blue + $bgcolor + $objcolor + $snd
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
