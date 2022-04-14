#
#	Gaplus
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand gp2-4.8d) + (expand gp2-3b.8c) + (expand gp2-2b.8b)
$prg2 = (expand gp2-8.11d) + (expand gp2-7.11c) + (expand gp2-6.11b)
$prg3 = expand gp2-1.4b
$bg = expand gp2-5.8s
$obj = (expand gp2-11.11p) + (expand gp2-10.11n) + (expand gp2-9.11m) + (expand gp2-12.11r)
$red = expand gp2-3.1p
$green = expand gp2-1.1n
$blue = expand gp2-2.2n
$bgcolor = expand gp2-7.6s
$objcolor_l = expand gp2-6.6p
$objcolor_h = expand gp2-5.6n
$snd = expand gp2-4.3f
$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[1])
$prg = expand 62xx.bin

$rom = $prg1 + $prg2 + $prg3 + $bg + $obj + $red + $green + $blue + $bgcolor + $objcolor_l + $objcolor_h + $snd + $prg
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[2]
