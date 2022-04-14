#
#	Grobda
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand gr2-3.1d) + (expand gr2-2.1c) + (expand gr2-1.1b)
$prg2 = expand gr1-4.1k
$bg = expand gr1-7.3c
$obj = (expand gr1-5.3f) + (expand gr1-6.3e)
$rgb = expand gr1-6.4c
$bgcolor = expand gr1-5.4e
$objcolor = expand gr1-4.3l
$snd = expand gr1-3.3m

$rom = $prg1 + $prg2 + $bg + $obj + $rgb + $bgcolor + $objcolor + $snd
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
