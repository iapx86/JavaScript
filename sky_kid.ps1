#
#	Sky Kid
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand sk2_2.6c) + (expand sk1-1c.6b) + (expand sk1_3.6d)
$prg2 = expand sk2_4.3c
$prg2i = expand cus63-63a1.mcu
$fg = expand sk1_6.6l
$bg = expand sk1_5.7e
$obj = (expand sk1_8.10n) + (expand sk1_7.10m)
$red = expand sk1-1.2n
$green = expand sk1-2.2p
$blue = expand sk1-3.2r
$bgcolor = expand sk1-4.5n
$objcolor = expand sk1-5.6n

$rom = $prg1 + $prg2 + $prg2i + $fg + $bg + $obj + $red + $green + $blue + $bgcolor + $objcolor
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
