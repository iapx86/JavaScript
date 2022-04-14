#
#	Time Tunnel
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand un01.69) + (expand un02.68) + (expand un03.67) + (expand un04.66) + (expand un05.65) + (expand un06.64) + (expand un07.55) + (expand un08.54) + (expand un09.53) + (expand un10.52)
$prg2 = expand un19.70
$gfx = (expand un11.1) + (expand un12.2) + (expand un13.3) + (expand un14.4) + (expand un15.5) + (expand un16.6) + (expand un17.7) + (expand un18.8)
$pri = expand eb16.22

$rom = $prg1 + $prg2 + $gfx + $pri
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
