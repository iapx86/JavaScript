#
#	Sea Fighter Poseidon
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand a14-01.1) + (expand a14-02.2) + (expand a14-03.3) + (expand a14-04.6) + (expand a14-05.7)
$prg2 = (expand a14-10.70) + (expand a14-11.71)
$prg3 = expand a14-12
$gfx = (expand a14-06.4) + (expand a14-07.5) + (expand a14-08.9) + (expand a14-09.10)
$pri = expand eb16.22

$rom = $prg1 + $prg2 + $prg3 + $gfx + $pri
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
