#
#	Star Force
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand 3.3p) + (expand 2.3mn)
$prg2 = expand 1.3hj
$fg = (expand 7.2fh) + (expand 8.3fh) + (expand 9.3fh)
$bg1 = (expand 15.10jk) + (expand 14.9jk) + (expand 13.8jk)
$bg2 = (expand 12.10de) + (expand 11.9de) + (expand 10.8de)
$bg3 = (expand 18.10pq) + (expand 17.9pq) + (expand 16.8pq)
$obj = (expand 6.10lm) + (expand 5.9lm) + (expand 4.8lm)
$snd = expand 07b.bin

$rom = $prg1 + $prg2 + $fg + $bg1 + $bg2 + $bg3 + $obj + $snd
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
