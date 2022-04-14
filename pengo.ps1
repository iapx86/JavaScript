#
#	Pengo
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg = (expand epr-1689c.ic8) + (expand epr-1690b.ic7) + (expand epr-1691b.ic15) + (expand epr-1692b.ic14) + (expand epr-1693b.ic21) + (expand epr-1694b.ic20) + (expand epr-5118b.ic32) + (expand epr-5119c.ic31)
$bg = (expand epr-1640.ic92)[0..0xfff] + (expand epr-1695.ic105)[0..0xfff]
$obj = (expand epr-1640.ic92)[0x1000..0x1fff] + (expand epr-1695.ic105)[0x1000..0x1fff]
$rgb = expand pr1633.ic78
$color = expand pr1634.ic88
$snd = expand pr1635.ic51

$rom = $prg + $bg + $obj + $rgb + $color + $snd
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
