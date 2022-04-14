#
#	Space Harrier
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg3 = (expand epr-7234.ic73) + (expand epr-7233.ic72)
$pcm = (expand epr-7231.ic5) + (expand epr-7232.ic6)

$rom = $prg3 + $pcm
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
