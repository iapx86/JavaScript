#
#	Rally-X
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg = (expand 1b) + (expand rallyxn.1e) + (expand rallyxn.1h) + (expand rallyxn.1k)
$bgobj = expand 8e
$rgb = expand rx1-1.11n
$color = expand rx1-7.8p
$snd = expand rx1-5.3p

$rom = $prg + $bgobj + $rgb + $color + $snd
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
