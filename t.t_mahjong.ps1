#
#	T.T Mahjong
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand ttmahjng/ju04) + (expand j3) + (expand ttmahjng/ju06) + (expand ttmahjng/ju07)
$prg2 = (expand ttmahjng/ju01) + (expand ttmahjng/ju02) + (expand ttmahjng/ju08)
$color1 = expand ju03
$color2 = expand ju09

$rom = $prg1 + $prg2 + $color1 + $color2
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
