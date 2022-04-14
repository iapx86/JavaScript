#
#	Out Run
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg3 = expand epr-10187.88
$pcm = (expand opr-10193.66) * 2 + (expand opr-10192.67) * 2 + (expand opr-10191.68) * 2 + (expand opr-10190.69) * 2 + (expand opr-10189.70) * 2 + (expand opr-10188.71) * 2 + [Byte[]]@(0xff) * 0x20000

$rom = $prg3 + $pcm
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
