#
#	Dragon Buster
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand db1_2b.6c) + (expand db1_1.6b) + (expand db1_3.6d)
$prg2 = expand db1_4.3c
$prg2i = expand cus60-60a1.mcu
$fg = expand db1_6.6l
$bg = expand db1_5.7e
$obj = (expand db1_8.10n) + (expand db1_7.10m)
$red = expand db1-1.2n
$green = expand db1-2.2p
$blue = expand db1-3.2r
$bgcolor = expand db1-4.5n
$objcolor = expand db1-5.6n

$rom = $prg1 + $prg2 + $prg2i + $fg + $bg + $obj + $red + $green + $blue + $bgcolor + $objcolor
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
