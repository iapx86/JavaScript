#
#	Jump Bug
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg = (expand jb1) + (expand jb2) + (expand jumpbugb/jb3b) + (expand jb4) + (expand jumpbugb/jb5b) + (expand jumpbugb/jb6b) + (expand jumpbugb/jb7b)
$bg = (expand jbl) + (expand jbn) + (expand jbm) + (expand jbi) + (expand jbk) + (expand jbj)
$rgb = expand l06_prom.bin

$rom = $prg + $bg + $rgb
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
