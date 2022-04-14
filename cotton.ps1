#
#	Cotton
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = merge ((expand cottonj/epr-13858b.a7) + (expand cottonj/epr-13859b.a8)) ((expand cottonj/epr-13856b.a5) + (expand cottonj/epr-13857b.a6))
$key = expand cottonj/317-0179b.key
$bg = (expand opr-13862.a14) + (expand opr-13877.b14) + (expand opr-13863.a15) + (expand opr-13878.b15) + (expand opr-13864.a16) + (expand opr-13879.b16)
$obj = merge ((expand opr-13869.b5) + (expand opr-13870.b6) + (expand opr-13871.b7) + (expand opr-13872.b8)) ((expand opr-13865.b1) + (expand opr-13866.b2) + (expand opr-13867.b3) + (expand opr-13868.b4))
$obj += merge ((expand opr-13873.b10) + (expand opr-13874.b11) + (expand cottonj/opr-13875.b12) + (expand opr-13876.b13)) ((expand opr-13852.a1) + (expand opr-13853.a2) + (expand cottonj/opr-13854.a3) + (expand opr-13855.a4))
$prg2 = (expand cottonj/epr-13860.a10) + (expand cottonj/opr-13061.a11)

$rom = $prg1 + $key + $bg + $obj + $prg2
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
