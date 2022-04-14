#
#	Master of Weapon
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg2 = expand b72_07.30

$rom = $prg2
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
