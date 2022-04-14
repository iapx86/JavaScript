#
#	Cue Brick
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = merge ((expand cuebrickj/903_e05.6n) + (expand cuebrickj/903_e09.6r)) ((expand cuebrickj/903_e04.4n) + (expand cuebrickj/903_e08.4r))
$prg2 = merge ((expand cuebrickj/903_d07.10n) + (expand cuebrickj/903_e13.10s)) ((expand cuebrickj/903_d06.8n) + (expand cuebrickj/903_e12.8s))
$prg3 = expand cuebrickj/903_d03.10a
$bg = expand cuebrickj/903_e14.d8
$data = merge (expand cuebrickj/903_e11.10r) (expand cuebrickj/903_e10.8r)

$rom = $prg1 + $prg2 + $prg3 + $bg + $data
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
