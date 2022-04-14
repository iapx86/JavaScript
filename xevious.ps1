#
#	Xevious
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand xvi_1.3p) + (expand xvi_2.3m) + (expand xvi_3.2m) + (expand xvi_4.2l)
$prg2 = (expand xvi_5.3f) + (expand xvi_6.3j)
$prg3 = expand xvi_7.2c
$bg2 = expand xvi_12.3b
$bg4 = (expand xvi_13.3c) + (expand xvi_14.3d)
$obj = (expand xvi_15.4m) + (expand xvi_17.4p) + (expand xvi_18.4r) + (expand xvi_16.4n)
$maptbl = (expand xvi_9.2a) + (expand xvi_10.2b)
$mapdata = expand xvi_11.2c
$red = expand xvi-8.6a
$green = expand xvi-9.6d
$blue = expand xvi-10.6e
$bgcolor_l = expand xvi-7.4h
$bgcolor_h = expand xvi-6.4f
$objcolor_l = expand xvi-4.3l
$objcolor_h = expand xvi-5.3m
$snd = expand xvi-2.7n
$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[1])
$key = expand 50xx.bin
$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[2])
$io = expand 51xx.bin
$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[3])
$prg = expand 54xx.bin

$rom = $prg1 + $prg2 + $prg3 + $bg2 + $bg4 + $obj + $maptbl + $mapdata + $red + $green + $blue + $bgcolor_l + $bgcolor_h + $objcolor_l + $objcolor_h + $snd + $key + $io + $prg
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[4]
