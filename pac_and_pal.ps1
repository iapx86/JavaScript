#
#	Pac & Pal
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand pap1-3b.1d) + (expand pap1-2b.1c) + (expand pap3-1.1b)
$prg2 = expand pap1-4.1k
$bg = expand pap1-6.3c
$obj = expand pap1-5.3f
$rgb = expand pap1-6.4c
$bgcolor = expand pap1-5.4e
$objcolor = expand pap1-4.3l
$snd = expand pap1-3.3m

$rom = $prg1 + $prg2 + $bg + $obj + $rgb + $bgcolor + $objcolor + $snd
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
