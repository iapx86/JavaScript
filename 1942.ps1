#
#	1942
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand srb-03.m3) + (expand srb-04.m4) + (expand srb-05.m5) + (expand srb-06.m6) + [Byte[]]@(0xff) * 0x2000 + (expand srb-07.m7) + [Byte[]]@(0xff) * 0x4000
$prg2 = expand sr-01.c11
$fg = expand sr-02.f2
$bg = (expand sr-08.a1) + (expand sr-09.a2) + (expand sr-10.a3) + (expand sr-11.a4) + (expand sr-12.a5) + (expand sr-13.a6)
$obj = (expand sr-14.l1) + (expand sr-15.l2) + (expand sr-16.n1) + (expand sr-17.n2)
$red = expand sb-5.e8
$green = expand sb-6.e9
$blue = expand sb-7.e10
$fgcolor = expand sb-0.f1
$bgcolor = expand sb-4.d6
$objcolor = expand sb-8.k3

$rom = $prg1 + $prg2 + $fg + $bg + $obj + $red + $green + $blue + $fgcolor + $bgcolor + $objcolor
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
