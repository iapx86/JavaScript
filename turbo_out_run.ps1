#
#	Turbo Out Run
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg3 = expand epr-12300.88
$pcm = (expand opr-12301.66) + (expand opr-12302.67) + (expand opr-12303.68) + (expand opr-12304.69) + (expand opr-12305.70) + (expand opr-12306.71) + [Byte[]]@(0xff) * 0x20000

$rom = $prg3 + $pcm
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
