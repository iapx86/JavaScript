#
#	Galaga
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand gg1_1b.3p) + (expand gg1_2b.3m) + (expand gg1_3.2m) + (expand gg1_4b.2l)
$prg2 = expand gg1_5b.3f
$prg3 = expand gg1_7b.2c
$bg = expand gg1_9.4l
$obj = (expand gg1_11.4d) + (expand gg1_10.4f)
$rgb = expand prom-5.5n
$bgcolor = expand prom-4.2n
$objcolor = expand prom-3.1c
$snd = expand prom-1.1d
$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[1])
$io = expand 51xx.bin
$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[2])
$prg = expand 54xx.bin

$rom = $prg1 + $prg2 + $prg3 + $bg + $obj + $rgb + $bgcolor + $objcolor + $snd + $io + $prg
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[3]
