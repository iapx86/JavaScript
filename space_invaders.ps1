#
#	Space Invaders
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg = (expand sicv/cv17.36) + (expand sicv/cv18.35) + (expand sicv/cv19.34) + (expand sicv/cv20.33)
$map = (expand sicv/cv01.1) + (expand sicv/cv02.2)

$rom = $prg + $map
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
