#
#	Toypop
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand tp1-2.5b) + (expand tp1-1.5c)
$prg2 = expand tp1-3.2c
$prg3 = merge (expand tp1-4.8c) (expand tp1-5.10c)
$bg = expand tp1-7.5p
$obj = expand tp1-6.9t
$red = expand tp1-3.1r
$green = expand tp1-2.1s
$blue = expand tp1-1.1t
$bgcolor = expand tp1-4.5l
$objcolor = expand tp1-5.2p
$snd = expand tp1-6.3d

$rom = $prg1 + $prg2 + $prg3 + $bg + $obj + $red + $green + $blue + $bgcolor + $objcolor + $snd
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
