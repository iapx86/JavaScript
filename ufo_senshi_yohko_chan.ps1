#
#	Ufo Senshi Yohko Chan
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand epr-11661.90) + (expand epr-11662.91) + (expand epr-11663.92)
$key = expand 317-0064.key
$prg2 = expand epr-11667.126
$bg = (expand epr-11664.4) + (expand epr-11665.5) + (expand epr-11666.6)
$obj = (expand epr-11658.87) + (expand epr-11657.86) + (expand epr-11660.89) + (expand epr-11659.88)
$red = expand pr11656.20
$green = expand pr11655.14
$blue = expand pr11654.8
$pri = expand pr5317.28

$rom = $prg1 + $key + $prg2 + $bg + $obj + $red + $green + $blue + $pri
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
