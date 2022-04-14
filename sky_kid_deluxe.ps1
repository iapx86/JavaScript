#
#	Sky Kid Deluxe
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand sk3_2.9d) + (expand sk3_1b.9c)
$prg2 = expand sk3_3.12c
$bg1 = (expand sk3_9.7r) + (expand sk3_10.7s)
$bg2 = (expand sk3_7.4r) + (expand sk3_8.4s)
$obj = (expand sk3_5.12h) + (expand sk3_6.12k)
$red = expand sk3-1.3r
$blue = expand sk3-2.3s
$bgcolor = expand sk3-3.4v
$objcolor = expand sk3-4.5v
$bgaddr = expand sk3-5.6u
$prg3 = expand sk3_4.6b
$prg3i = expand cus60-60a1.mcu

$rom = $prg1 + $prg2 + $bg1 + $bg2 + $obj + $red + $blue + $bgcolor + $objcolor + $bgaddr + $prg3 + $prg3i
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
