#
#	Gradius III
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg3 = expand 945_r05.d9
$snd = (expand 945_a10.b15) + (expand 945_l11a.c18) + (expand 945_l11b.c20)

$rom = $prg3 + $snd
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
