#
#	Tetris
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = merge (expand epr-12201.rom) (expand epr-12200.rom)
$prg1_bootleg = merge (expand tetrisd/bootleg_epr-12201.rom) (expand tetrisd/bootleg_epr-12200.rom)
$prg1_bootleg_2 = merge (expand tetris2d/bootleg_epr-12193.a7) (expand tetris2d/bootleg_epr-12192.a5)
$key = expand 317-0093.key
$bg = (expand epr-12202.rom) + (expand epr-12203.rom) + (expand epr-12204.rom)
$obj = merge (expand epr-12170.b5) (expand epr-12169.b1)
$prg2 = expand epr-12205.rom

$rom = $prg1 + $key + $bg + $obj + $prg2
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
