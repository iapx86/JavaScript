#
#	Strategy X
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand 2c_1.bin) + (expand 2e_2.bin) + (expand 2f_3.bin) + (expand 2h_4.bin) + (expand 2j_5.bin) + (expand 2l_6.bin)
$prg2 = (expand s1.bin) + (expand s2.bin)
$bg = (expand 5f_c2.bin) + (expand 5h_c1.bin)
$rgb = expand strategy.6e
$map = expand strategy.10k

$rom = $prg1 + $prg2 + $bg + $rgb + $map
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
