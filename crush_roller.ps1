#
#	Crush Roller
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg = (expand crush2/tp1) + (expand crush2/tp5a) + (expand crush2/tp2) + (expand crush2/tp6) + (expand crush2/tp3) + (expand crush2/tp7) + (expand crush2/tp4) + (expand crush2/tp8)
$bg = (expand crush2/tpa) + (expand crush2/tpc)
$obj = (expand crush2/tpb) + (expand crush2/tpd)
$rgb = expand 82s123.7f
$color = expand 2s140.4a
$snd = expand 82s126.1m

$rom = $prg + $bg + $obj + $rgb + $color + $snd
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
