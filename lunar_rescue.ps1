#
#	Lunar Rescue
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand lrescue.1) + (expand lrescue.2) + (expand lrescue.3) + (expand lrescue.4)
$prg2 = (expand lrescue.5) + (expand lrescue.6)
$map = (expand 7643-1.cpu) * 2

$rom = $prg1 + $prg2 + $map
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
