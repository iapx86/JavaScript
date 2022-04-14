#
#	Senjou no Ookami
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand commandoj/so04.9m) + (expand commandoj/so03.8m)
$prg2 = expand "commandob2/8,so02.9f"
$fg = expand vt01.5d
$bg = (expand vt11.5a) + (expand vt12.6a) + (expand vt13.7a) + (expand vt14.8a) + (expand vt15.9a) + (expand vt16.10a)
$obj = (expand vt05.7e) + (expand vt06.8e) + (expand vt07.9e) + [Byte[]]@(0xff) * 0x4000 + (expand vt08.7h) + (expand vt09.8h) + (expand vt10.9h) + [Byte[]]@(0xff) * 0x4000
$red = expand vtb1.1d
$green = expand vtb2.2d
$blue = expand vtb3.3d

$rom = $prg1 + $prg2 + $fg + $bg + $obj + $red + $green + $blue
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
