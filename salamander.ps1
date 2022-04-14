#
#	Salamander
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = merge ((expand 587-d02.18b) + (expand 587-c03.17b)) ((expand 587-d05.18c) + (expand 587-c06.17c))
$prg2 = expand 587-d09.11j
$vlm = expand 587-d08.8g
$snd = expand 587-c01.10a

$rom = $prg1 + $prg2 + $vlm + $snd
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
