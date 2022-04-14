#
#	Gradius II
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg3 = expand 785_g03.10a
$snd = expand 785_f01.5a
$voi = expand 785_f02.7c

$rom = $prg3 + $snd + $voi
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
