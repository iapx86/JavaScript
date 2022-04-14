#
#	Mappy
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand mappyj/mp1_3.1d) + (expand mp1_2.1c) + (expand mappyj/mp1_1.1b)
$prg2 = expand mp1_4.1k
$bg = expand mp1_5.3b
$obj = (expand mp1_7.3n) + (expand mp1_6.3m)
$rgb = expand mp1-5.5b
$bgcolor = expand mp1-6.4c
$objcolor = expand mp1-7.5k
$snd = expand mp1-3.3m

$rom = $prg1 + $prg2 + $bg + $obj + $rgb + $bgcolor + $objcolor + $snd
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
