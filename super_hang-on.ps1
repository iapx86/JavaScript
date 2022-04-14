#
#	Super Hang-On
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg3 = expand epr-10649c.88
$pcm = (expand epr-10643.66) * 2 + (expand epr-10644.67) * 2 + (expand epr-10645.68) * 2 + (expand epr-10646.69) * 2 + [Byte[]]@(0xff) * 0x40000

$rom = $prg3 + $pcm
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
