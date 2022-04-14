#
#	Wonder Boy III
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = merge ((expand wb31/epr-12084.bin) + (expand wb31/epr-12085.bin)) ((expand wb31/epr-12082.bin) + (expand wb31/epr-12083.bin))
$key = expand wb31/317-0084.key
$bg = (expand wb31/epr-12086.bin) + (expand wb31/epr-12087.bin) + (expand wb31/epr-12088.bin)
$obj = merge ((expand epr-12094.b5)[0..0x7fff] + (expand epr-12095.b6)[0..0x7fff]) ((expand epr-12090.b1)[0..0x7fff] + (expand epr-12091.b2)[0..0x7fff])
$obj += merge ((expand epr-12096.b7)[0..0x7fff] + (expand epr-12097.b8)[0..0x7fff]) ((expand epr-12092.b3)[0..0x7fff] + (expand epr-12093.b4)[0..0x7fff])
$obj += merge ((expand epr-12094.b5)[0x8000..0xffff] + (expand epr-12095.b6)[0x8000..0xffff]) ((expand epr-12090.b1)[0x8000..0xffff] + (expand epr-12091.b2)[0x8000..0xffff])
$obj += merge ((expand epr-12096.b7)[0x8000..0xffff] + (expand epr-12097.b8)[0x8000..0xffff]) ((expand epr-12092.b3)[0x8000..0xffff] + (expand epr-12093.b4)[0x8000..0xffff])
$prg2 = expand wb31/epr-12089.bin

$rom = $prg1 + $key + $bg + $obj + $prg2
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
