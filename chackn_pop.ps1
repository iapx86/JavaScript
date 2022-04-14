#
#	Chack'n Pop
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand ao4_01.ic28) + (expand ao4_02.ic27) + (expand ao4_03.ic26) + (expand ao4_04.ic25) + (expand ao4_05.ic3)
$prg2 = expand ao4_06.ic23
$obj = (expand ao4_08.ic14) + (expand ao4_07.ic15)
$bg = (expand ao4_09.ic98) + (expand ao4_10.ic97)
$rgb_l = expand ao4-11.ic96
$rgb_h = expand ao4-12.ic95

$rom = $prg1 + $prg2 + $obj + $bg + $rgb_l + $rgb_h
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
