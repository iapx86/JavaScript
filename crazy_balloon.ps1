#
#	Crazy Balloon
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg = (expand cl01.bin) + (expand cl02.bin) + (expand cl03.bin) + (expand cl04.bin) + (expand cl05.bin) + (expand cl06.bin)
$bg = expand cl07.bin
$obj = expand cl08.bin

$rom = $prg + $bg + $obj
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
