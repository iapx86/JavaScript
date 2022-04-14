#
#	Genpei ToumaDen
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand gt1_10b.f1) + (expand gt1_1b.9c)
$prg2 = expand gt1_2.12c
$bg1 = (expand gt1_7.7r) + (expand gt1_6.7s)
$bg2 = (expand gt1_5.4r) + (expand gt1_4.4s)
$obj = (expand gt1_11.12h) + (expand gt1_12.12k) + (expand gt1_13.12l) + (expand gt1_14.12m) + (expand gt1_15.12p) + (expand gt1_16.12r) + (expand gt1_8.12t) * 2 + (expand gt1_9.12u) * 2
$red = expand gt1-1.3r
$blue = expand gt1-2.3s
$bgcolor = expand gt1-3.4v
$objcolor = expand gt1-4.5v
$bgaddr = expand gt1-5.6u
$prg3 = expand gt1_3.6b
$prg3i = expand cus60-60a1.mcu
$pcm = (expand gt1_17.f3) + (expand gt1_18.h3) + (expand gt1_19.k3)

$rom = $prg1 + $prg2 + $bg1 + $bg2 + $obj + $red + $blue + $bgcolor + $objcolor + $bgaddr + $prg3 + $prg3i + $pcm
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
