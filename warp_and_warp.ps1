#
#	Warp & Warp
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg = (expand ww1_prg1.s10) + (expand ww1_prg2.s8) + (expand ww1_prg3.s4)
$bg = expand ww1_chg1.s12

$rom = $prg + $bg
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
