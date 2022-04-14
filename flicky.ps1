#
#	Flicky
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand flickyo/epr-5857.bin) + (expand flickyo/epr-5858a.bin) + (expand flickyo/epr-5859.bin) + (expand flickyo/epr-5860.bin)
$prg2 = expand epr-5869.120
$bg = (expand epr-5868.62) + (expand epr-5867.61) + (expand epr-5866.64) + (expand epr-5865.63) + (expand epr-5864.66) + (expand epr-5863.65)
$obj = (expand epr-5855.117) + (expand epr-5856.110)
$pri = expand pr-5317.76

$rom = $prg1 + $prg2 + $bg + $obj + $pri
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
