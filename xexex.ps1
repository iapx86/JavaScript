#
#	Xexex
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg2 = expand xexexj/067jaa05.4e
$pcm = (expand 067b06.3e) + (expand 067b07.1e)

$rom = $prg2 + $pcm
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
