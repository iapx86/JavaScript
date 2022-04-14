#
#	Space Laser
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg = (expand intruder/la01-1.36) + (expand spcewarl.2) + (expand spclaser/la03) + (expand intruder/la04-1.33)
$map = (expand 01.1) + (expand 02.2)

$rom = $prg + $map
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
