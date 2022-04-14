#
#	The Return of Ishtar
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand ri1_2.9d) + (expand ri1_1c.9c)
$prg2 = expand ri1_3.12c
$bg1 = (expand ri1_14.7r) + (expand ri1_15.7s)
$bg2 = (expand ri1_12.4r) + (expand ri1_13.4s)
$obj = (expand ri1_5.12h) + (expand ri1_6.12k) + (expand ri1_7.12l) + (expand ri1_8.12m) + (expand ri1_9.12p) + (expand ri1_10.12r) + (expand ri1_11.12t) + [Byte[]]@(0xff) * 0x8000
$red = expand ri1-1.3r
$blue = expand ri1-2.3s
$bgcolor = expand ri1-3.4v
$objcolor = expand ri1-4.5v
$bgaddr = expand ri1-5.6u
$prg3 = expand ri1_4.6b
$prg3i = expand cus60-60a1.mcu

$rom = $prg1 + $prg2 + $bg1 + $bg2 + $obj + $red + $blue + $bgcolor + $objcolor + $bgaddr + $prg3 + $prg3i
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
