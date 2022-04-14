#
#	The Tower of Druaga
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand td2_3.1d) + (expand td2_1.1b)
$prg2 = expand td1_4.1k
$bg = expand td1_5.3b
$obj = (expand td1_7.3n) + (expand td1_6.3m)
$rgb = expand td1-5.5b
$bgcolor = expand td1-6.4c
$objcolor = expand td1-7.5k
$snd = expand td1-3.3m

$rom = $prg1 + $prg2 + $bg + $obj + $rgb + $bgcolor + $objcolor + $snd
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
