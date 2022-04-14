#
#	Time Pilot
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand tm1) + (expand tm2) + (expand tm3)
$prg2 = expand tm7
$bg = expand tm6
$obj = expand tm4
$obj += expand tm5
$rgb_h = expand timeplt.b4
$rgb_l = expand timeplt.b5
$objcolor = expand timeplt.e9
$bgcolor = expand timeplt.e12

$rom = $prg1 + $prg2 + $bg + $obj + $rgb_h + $rgb_l + $objcolor + $bgcolor
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
