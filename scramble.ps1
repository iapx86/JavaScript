#
#	Scramble
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand s1.2d) + (expand s2.2e) + (expand s3.2f) + (expand s4.2h) + (expand s5.2j) + (expand s6.2l) + (expand s7.2m) + (expand s8.2p)
$prg2 = (expand ot1.5c) + (expand ot2.5d) + (expand ot3.5e)
$bg = (expand c2.5f) + (expand c1.5h)
$rgb = expand c01s.6e

$rom = $prg1 + $prg2 + $bg + $rgb
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
