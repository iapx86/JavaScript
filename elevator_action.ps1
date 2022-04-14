#
#	Elevator Action
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand ba3__01.2764.ic1) + (expand ba3__02.2764.ic2) + (expand ba3__03-1.2764.ic3) + (expand ba3__04-1.2764.ic6)
$prg2 = (expand ba3__09.2732.ic70) + (expand ba3__10.2732.ic71)
$prg3 = expand ba3__11.mc68705p3.ic24
$gfx = (expand ba3__05.2764.ic4) + (expand ba3__06.2764.ic5) + (expand ba3__07.2764.ic9) + (expand ba3__08.2764.ic10)
$pri = expand eb16.ic22

$rom = $prg1 + $prg2 + $prg3 + $gfx + $pri
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
