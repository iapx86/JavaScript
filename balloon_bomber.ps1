#
#	Balloon Bomber
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand tn01) + (expand tn02) + (expand tn03) + (expand tn04)
$prg2 = expand tn05-1
$map = (expand tn06) + (expand tn07)

$rom = $prg1 + $prg2 + $map
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
