#
#	After Burner II
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg3 = expand epr-11112.17
$pcm = (expand mpr-10931.11) + (expand mpr-10930.12) + (expand epr-11102.13) + [Byte[]]@(0xff) * 0x20000

$rom = $prg3 + $pcm
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
