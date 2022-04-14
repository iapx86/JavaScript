#
#	Space Chaser
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand rt13.bin) + (expand rt14.bin) + (expand rt15.bin) + (expand rt16.bin) + (expand rt17.bin) + (expand rt18.bin) + (expand rt19.bin) + (expand rt20.bin)
$prg2 = (expand rt21.bin) + (expand rt22.bin)
$map = expand rt06.ic2

$rom = $prg1 + $prg2 + $map
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
