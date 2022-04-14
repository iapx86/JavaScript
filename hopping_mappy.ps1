#
#	Hopping Mappy
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = expand hm1_1.9c
$prg2 = expand hm1_2.12c
$bg1 = expand hm1_6.7r
$bg2 = expand hm1_5.4r
$obj = expand hm1_4.12h
$red = expand hm1-1.3r
$blue = expand hm1-2.3s
$bgcolor = expand hm1-3.4v
$objcolor = expand hm1-4.5v
$bgaddr = expand hm1-5.6u
$prg3 = expand hm1_3.6b
$prg3i = expand cus60-60a1.mcu

$rom = $prg1 + $prg2 + $bg1 + $bg2 + $obj + $red + $blue + $bgcolor + $objcolor + $bgaddr + $prg3 + $prg3i
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
