#
#	Tank Battalion
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg = (expand tb1-1.1a) + (expand tb1-2.1b) + (expand tb1-3.1c) + (expand tb1-4.1d)
$bg = expand tb1-5.2k
$rgb = expand bct1-1.l3

$rom = $prg + $bg + $rgb
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
