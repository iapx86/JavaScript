#
#	Gradius
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = merge ((expand gradius/400-a06.15l) + (expand gradius/456-a07.17l)) ((expand gradius/400-a04.10l) + (expand gradius/456-a05.12l))
$prg2 = expand gradius/400-e03.5l
$snd = (expand 400-a01.fse) + (expand 400-a02.fse)

$rom = $prg1 + $prg2 + $snd
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
