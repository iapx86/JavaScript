#
#	The NewZealand Story
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = expand b53-24.u1
$prg2 = expand tnzsj/b53-27.u3
$prg3 = expand b53-26.u34
$gfx = (expand b53-16.ic7) + (expand b53-17.ic8) + (expand b53-18.ic9) + (expand b53-19.ic10) + (expand b53-22.ic11) + (expand b53-23.ic13) + (expand b53-20.ic12) + (expand b53-21.ic14)

$rom = $prg1 + $prg2 + $prg3 + $gfx
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
