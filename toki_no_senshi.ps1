#
#	Toki no Senshi
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand epr-10961.ic90) + (expand epr-10962.ic91) + (expand epr-10963.ic92)
$key = expand 317-0040.key
$prg2 = expand epr-10967.ic126
$bg = (expand epr-10964.ic4) + (expand epr-10965.ic5) + (expand epr-10966.ic6)
$obj = (expand epr-10958.ic87) + (expand epr-10957.ic86) + (expand epr-10960.ic89) + (expand epr-10959.ic88)
$red = expand pr10956.ic20
$green = expand pr10955.ic14
$blue = expand pr10954.ic8
$pri = expand pr-5317.ic28

$rom = $prg1 + $key + $prg2 + $bg + $obj + $red + $green + $blue + $pri
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
