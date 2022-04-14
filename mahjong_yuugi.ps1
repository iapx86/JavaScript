#
#	Mahjong Yuugi
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg = merge ((expand mjyuugia/um_001.001) + (expand um001.002)) ((expand um001.003) + (expand um001.004))
$gfx = merge ((expand maj-001.10) + (expand maj-001.09) + (expand maj-001.06) + (expand maj-001.05)) ((expand maj-001.08) + (expand maj-001.07) + (expand maj-001.04) + (expand maj-001.03))
$voi = (expand maj-001.01) + (expand maj-001.02)

$rom = $prg + $gfx + $voi
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
