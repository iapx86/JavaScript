#
#	King & Balloon
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$voice = (expand kingballj/kbj1.ic4) + (expand kingballj/kbj2.ic5) + (expand kingballj/kbj3.ic6)
$prg = (expand prg1.7f) + (expand prg2.7j) + (expand prg3.7l)
$bg = (expand chg1.1h) + (expand chg2.1k)
$rgb = expand kb2-1

$rom = $voice + $prg + $bg + $rgb
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
