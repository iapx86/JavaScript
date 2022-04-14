#
#	Wonder Boy
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand wboy2/epr-7587.129) + (expand wboy2/epr-7588.130) + (expand wboy2/epr-7589.131) + (expand wboy2/epr-7590.132) + (expand wboy2/epr-7591.133) + (expand wboy2/epr-7592.134)
$prg2 = expand epr-7498.120
$bg = (expand epr-7497.62) + (expand epr-7496.61) + (expand epr-7495.64) + (expand epr-7494.63) + (expand epr-7493.66) + (expand epr-7492.65)
$obj = (expand epr-7485.117) + (expand epr-7487.04) + (expand epr-7486.110) + (expand epr-7488.05)
$pri = expand pr-5317.76

$rom = $prg1 + $prg2 + $bg + $obj + $pri
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
