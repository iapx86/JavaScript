#
#	Baraduke
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand bd1_3.9c) + (expand baraduke/bd1_1.9a) + (expand baraduke/bd1_2.9b)
$prg2 = expand baraduke/bd1_4b.3b
$prg2i = expand cus60-60a1.mcu
$fg = expand bd1_5.3j
$bg = (expand baraduke/bd1_8.4p) + (expand bd1_7.4n) + (expand baraduke/bd1_6.4m)
$obj = (expand bd1_9.8k) + (expand bd1_10.8l) + (expand bd1_11.8m) + (expand bd1_12.8n)
$green = expand bd1-1.1n
$red = expand bd1-2.2m

$rom = $prg1 + $prg2 + $prg2i + $fg + $bg + $obj + $green + $red
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
