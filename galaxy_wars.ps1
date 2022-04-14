#
#	Galaxy Wars
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand univgw3.0) + (expand univgw4.1) + (expand univgw5.2) + (expand univgw6.3)
$prg2 = (expand univgw1.4) + (expand univgw2.5)
$map = (expand 01.1) + (expand 02.2)

$rom = $prg1 + $prg2 + $map
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
