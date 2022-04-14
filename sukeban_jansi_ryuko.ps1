#
#	Sukeban Jansi Ryuko
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = merge ((expand sjryuko1/epr-12251.43) + (expand sjryuko1/epr-12252.42)) ((expand sjryuko1/epr-12249.26) + (expand sjryuko1/epr-12250.25))
$bg = (expand epr-12224-95.b9) + (expand epr-12225-94.b10) + (expand epr-12226-93.b11)
$obj = merge ((expand epr-12236-11.b5)[0..0x7fff] + (expand epr-12237-18.b6)[0..0x7fff]) ((expand epr-12232-10.b1)[0..0x7fff] + (expand epr-12233-17.b2)[0..0x7fff])
$obj += merge ((expand epr-12238-24.b7)[0..0x7fff] + (expand epr-12239-30.b8)[0..0x7fff]) ((expand epr-12234-23.b3)[0..0x7fff] + (expand epr-12235-29.b4)[0..0x7fff])
$obj += merge ((expand epr-12236-11.b5)[0x8000..0xffff] + (expand epr-12237-18.b6)[0x8000..0xffff]) ((expand epr-12232-10.b1)[0x8000..0xffff] + (expand epr-12233-17.b2)[0x8000..0xffff])
$obj += merge ((expand epr-12238-24.b7)[0x8000..0xffff] + (expand epr-12239-30.b8)[0x8000..0xffff]) ((expand epr-12234-23.b3)[0x8000..0xffff] + (expand epr-12235-29.b4)[0x8000..0xffff])
$prg2 = expand sjryuko1/epr-12227.12
$mcu = expand sjryuko1/7751.bin
$voi = (expand sjryuko1/epr-12228.1) + (expand sjryuko1/epr-12229.2) + (expand sjryuko1/epr-12230.4) + (expand sjryuko1/epr-12231.5)
$key = expand 317-5021.key

$rom = $prg1 + $bg + $obj + $prg2 + $mcu + $voi + $key
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
