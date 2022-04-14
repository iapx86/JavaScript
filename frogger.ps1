#
#	Frogger
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand frogger.26) + (expand frogger.27) + (expand frsm3.7)
$prg2 = (expand frogger.608) + (expand frogger.609) + (expand frogger.610)
$bg = (expand frogger.607) + (expand frogger.606)
$rgb = expand pr-91.6l

$rom = $prg1 + $prg2 + $bg + $rgb
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
