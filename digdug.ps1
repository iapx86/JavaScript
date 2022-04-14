#
#	DigDug
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand dd1a.1) + (expand dd1a.2) + (expand dd1a.3) + (expand dd1a.4)
$prg2 = (expand dd1a.5) + (expand dd1a.6)
$prg3 = expand dd1.7
$bg2 = expand dd1.9
$obj = (expand dd1.15) + (expand dd1.14) + (expand dd1.13) + (expand dd1.12)
$bg4 = expand dd1.11
$mapdata = expand dd1.10b
$rgb = expand 136007.113
$objcolor = expand 136007.111
$bgcolor = expand 136007.112
$snd = expand 136007.110
$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[1])
$io = expand 51xx.bin

$rom = $prg1 + $prg2 + $prg3 + $bg2 + $obj + $bg4 + $mapdata + $rgb + $objcolor + $bgcolor + $snd + $io
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[2]
