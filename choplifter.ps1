#
#	Choplifter
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand chopliftu/epr-7152.ic90) + (expand chopliftu/epr-7153.ic91) + (expand chopliftu/epr-7154.ic92)
$prg2 = expand epr-7130.ic126
$bg = (expand epr-7127.ic4) + (expand epr-7128.ic5) + (expand epr-7129.ic6)
$obj = (expand epr-7121.ic87) + (expand epr-7120.ic86) + (expand epr-7123.ic89) + (expand epr-7122.ic88)
$red = expand pr7119.ic20
$green = expand pr7118.ic14
$blue = expand pr7117.ic8
$pri = expand pr5317.ic28

$rom = $prg1 + $prg2 + $bg + $obj + $red + $green + $blue + $pri
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
