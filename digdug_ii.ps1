#
#	DigDug II
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand d23_3.1d) + (expand d23_1.1b)
$prg2 = expand d21_4.1k
$bg = expand d21_5.3b
$obj = (expand d21_7.3n) + (expand d21_6.3m)
$rgb = expand d21-5.5b
$bgcolor = expand d21-6.4c
$objcolor = expand d21-7.5k
$snd = expand d21-3.3m

$rom = $prg1 + $prg2 + $bg + $obj + $rgb + $bgcolor + $objcolor + $snd
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
