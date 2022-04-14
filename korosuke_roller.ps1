#
#	Korosuke Roller
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg = (expand korosuke/kr.6e) + (expand korosuke/kr.6f) + (expand korosuke/kr.6h) + (expand korosuke/kr.6j)
$bg = expand korosuke/kr.5e
$obj = expand korosuke/kr.5f
$rgb = expand 82s123.7f
$color = expand 2s140.4a
$snd = expand 82s126.1m

$rom = $prg + $bg + $obj + $rgb + $color + $snd
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
