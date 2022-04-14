#
#	Moon Cresta
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg = (expand mc1) + (expand mc2) + (expand mc3) + (expand mc4) + (expand mc5.7r) + (expand mc6.8d) + (expand mc7.8e) + (expand mc8)
$bg = (expand mcs_b) + (expand mcs_d) + (expand mcs_a) + (expand mcs_c)
$rgb = expand mmi6331.6l

$rom = $prg + $bg + $rgb
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
