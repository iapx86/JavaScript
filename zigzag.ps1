#
#	Zig Zag
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg = (expand zz_d1.7l) + (expand zz_d2.7k) + (expand zz_d4.7f) + (expand zz_d3.7h)
$bg = (expand zz_6.1h)[0..0x7ff] + (expand zz_5.1k)[0..0x7ff]
$obj = (expand zz_6.1h)[0x800..0xfff] + (expand zz_5.1k)[0x800..0xfff]
$rgb = expand zzbpr_e9.bin

$rom = $prg + $bg + $obj + $rgb
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
