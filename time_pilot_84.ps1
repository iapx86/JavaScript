#
#	Time Pilot '84
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand 388_f04.7j) + (expand 388_05.8j) + (expand 388_f06.9j) + (expand 388_07.10j)
$prg2 = expand 388_f08.10d
$prg3 = expand 388j13.6a
$bg = (expand 388_h02.2j) + (expand 388_d01.1j)
$obj = (expand 388_e09.12a) + (expand 388_e10.13a) + (expand 388_e11.14a) + (expand 388_e12.15a)
$red = expand 388d14.2c
$green = expand 388d15.2d
$blue = expand 388d16.1e
$bgcolor = expand 388d18.1f
$objcolor = expand 388j17.16c

$rom = $prg1 + $prg2 + $prg3 + $bg + $obj + $red + $green + $blue + $objcolor + $bgcolor
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
