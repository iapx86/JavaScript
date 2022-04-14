#
#	Golden Axe
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = merge ((expand goldnaxej/epr-12540.a7) + (expand goldnaxe2/epr-12521.a8)) ((expand goldnaxej/epr-12539.a5) + (expand goldnaxe2/epr-12519.a6))
$key = expand goldnaxej/317-0121.key
$bg = (expand epr-12385.ic19) + (expand epr-12386.ic20) + (expand epr-12387.ic21)
$obj = merge ((expand mpr-12379.ic12)[0..0x1ffff] + (expand mpr-12381.ic13)[0..0x1ffff]) ((expand mpr-12378.ic9)[0..0x1ffff] + (expand mpr-12380.ic10)[0..0x1ffff])
$obj += (merge (expand mpr-12383.ic14)[0..0x1ffff] (expand mpr-12382.ic11)[0..0x1ffff]) + [Byte[]]@(0xff) * 0x40000
$obj += merge ((expand mpr-12379.ic12)[0x20000..0x3ffff] + (expand mpr-12381.ic13)[0x20000..0x3ffff]) ((expand mpr-12378.ic9)[0x20000..0x3ffff] + (expand mpr-12380.ic10)[0x20000..0x3ffff])
$obj += (merge (expand mpr-12383.ic14)[0x20000..0x3ffff] (expand mpr-12382.ic11)[0x20000..0x3ffff]) + [Byte[]]@(0xff) * 0x40000
$prg2 = (expand epr-12390.ic8) + (expand mpr-12384.ic6)

$rom = $prg1 + $key + $bg + $obj + $prg2
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
