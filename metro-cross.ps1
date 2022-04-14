#
#	Metro-Cross
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand mc1-3.9c) + (expand mc1-1.9a) + (expand mc1-2.9b)
$prg2 = expand mc1-4.3b
$prg2i = expand cus60-60a1.mcu
$fg = expand mc1-5.3j
$bg = (expand mc1-7.4p) + (expand mc1-6.4n) + [Byte[]]@(0xff) * 0x4000
$obj = (expand mc1-8.8k) + (expand mc1-9.8l)
$green = expand mc1-1.1n
$red = expand mc1-2.2m

$rom = $prg1 + $prg2 + $prg2i + $fg + $bg + $obj + $green + $red
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
