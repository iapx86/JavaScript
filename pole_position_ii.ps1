#
#	Pole Position II
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg = (expand pp4_9.6h) + (expand pp4_10.5h)
$snd = expand pp1-5.3b

$rom = $prg + $snd
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
