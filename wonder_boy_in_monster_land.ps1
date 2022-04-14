#
#	Wonder Boy in Monster Land
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand epr-11031a.90) + (expand epr-11032.91) + (expand epr-11033.92)
$key = expand 317-0043.key
$prg2 = expand epr-11037.126
$bg = (expand epr-11034.4) + (expand epr-11035.5) + (expand epr-11036.6)
$obj = (expand epr-11028.87) + (expand epr-11027.86) + (expand epr-11030.89) + (expand epr-11029.88)
$red = expand pr11026.20
$green = expand pr11025.14
$blue = expand pr11024.8
$pri = expand pr5317.37

$rom = $prg1 + $key + $prg2 + $bg + $obj + $red + $green + $blue + $pri
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
