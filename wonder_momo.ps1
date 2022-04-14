#
#	Wonder Momo
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand wm1_16.f1) + (expand wm1_1.9c)
$prg2 = expand wm1_2.12c
$bg1 = (expand wm1_6.7r) + (expand wm1_7.7s)
$bg2 = (expand wm1_4.4r) + (expand wm1_5.4s)
$obj = (expand wm1_8.12h) + (expand wm1_9.12k) + (expand wm1_10.12l) + (expand wm1_11.12m) + (expand wm1_12.12p) + (expand wm1_13.12r) + (expand wm1_14.12t) + (expand wm1_15.12u)
$red = expand wm1-1.3r
$blue = expand wm1-2.3s
$bgcolor = expand wm1-3.4v
$objcolor = expand wm1-4.5v
$bgaddr = expand wm1-5.6u
$prg3 = expand wm1_3.6b
$prg3i = expand cus60-60a1.mcu
$pcm = (expand wm1_17.f3) * 2 + (expand wm1_18.h3) * 2 + (expand wm1_19.k3) * 2 + (expand wm1_20.m3) * 2

$rom = $prg1 + $prg2 + $bg1 + $bg2 + $obj + $red + $blue + $bgcolor + $objcolor + $bgaddr + $prg3 + $prg3i + $pcm
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
