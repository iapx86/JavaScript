#
#	R Type II
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg2 = expand ic17.4f
$pcm = expand ic14.4c

$rom = $prg2 + $pcm
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
