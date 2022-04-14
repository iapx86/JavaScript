#
#	Polaris
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand ps01-1.ic71) + (expand ps02-9.ic70) + (expand ps03-1.ic69) + (expand ps04-18.ic62)
$prg2 = (expand ps05.ic61) + (expand ps06-10.ic60) + (expand ps26.ic60a)
$map = expand ps08.1b
$obj = expand ps07.2c

$rom = $prg1 + $prg2 + $map + $obj
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
