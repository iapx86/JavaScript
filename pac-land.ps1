#
#	Pac-Land
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand paclandj/pl6_01.8b) + (expand paclandj/pl6_02.8d) + (expand pl1_3.8e) + (expand pl1_4.8f) + (expand pl1_5.8h) + (expand paclandj/pl1_6.8j)
$prg2 = expand pl1_7.3e
$prg2i = expand cus60-60a1.mcu
$fg = expand paclandj/pl6_12.6n
$bg = expand paclandj/pl1_13.6t
$obj = (expand paclandj/pl1_9b.6f) + (expand paclandj/pl1_8.6e) + (expand paclandj/pl1_10b.7e) + (expand paclandj/pl1_11.7f)
$red = expand pl1-2.1t
$blue = expand pl1-1.1r
$fgcolor = expand pl1-5.5t
$bgcolor = expand pl1-4.4n
$objcolor = expand pl1-3.6l

$rom = $prg1 + $prg2 + $prg2i + $fg + $bg + $obj + $red + $blue + $fgcolor + $bgcolor + $objcolor
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
