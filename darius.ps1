#
#	Darius
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg2 = expand a96_57.33
$prg4 = expand a96_56.18

$rom = $prg2 + $prg4
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
