#
#	Motos
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand mo1_3.1d) + (expand mo1_1.1b)
$prg2 = expand mo1_4.1k
$bg = expand mo1_5.3b
$obj = (expand mo1_7.3n) + (expand mo1_6.3m)
$rgb = expand mo1-5.5b
$bgcolor = expand mo1-6.4c
$objcolor = expand mo1-7.5k
$snd = expand mo1-3.3m

$rom = $prg1 + $prg2 + $bg + $obj + $rgb + $bgcolor + $objcolor + $snd
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
