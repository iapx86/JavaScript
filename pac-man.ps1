#
#	Pac-Man
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg = (expand pm1_prg1.6e) + (expand pm1_prg2.6k) + (expand pm1_prg3.6f) + (expand pm1_prg4.6m) + (expand pm1_prg5.6h) + (expand pm1_prg6.6n) + (expand pm1_prg7.6j) + (expand pm1_prg8.6p)
<# bootleg set 1
$prg = (expand puckmanb/namcopac.6e) + (expand puckmanb/namcopac.6f) + (expand puckmanb/namcopac.6h) + (expand puckmanb/namcopac.6j)
#>
$bg = (expand pm1_chg1.5e) + (expand pm1_chg2.5h)
$obj = (expand pm1_chg3.5f) + (expand pm1_chg4.5j)
$rgb = expand pm1-1.7f
$color = expand pm1-4.4a
$snd = expand pm1-3.1m

$rom = $prg + $bg + $obj + $rgb + $color + $snd
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
