#
#	Super Pac-Man
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand sp1-2.1c) + (expand sp1-1.1b)
$prg2 = expand spc-3.1k
$bg = expand sp1-6.3c
$obj = expand spv-2.3f
$rgb = expand superpac.4c
$bgcolor = expand superpac.4e
$objcolor = expand superpac.3l
$snd = expand superpac.3m

$rom = $prg1 + $prg2 + $bg + $obj + $rgb + $bgcolor + $objcolor + $snd
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
