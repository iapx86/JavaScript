#
#	Jr. Pac-Man
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg = (expand jrp8d.8d) + (expand jrp8e.8e) + (expand jrp8h.8h) + (expand jrp8j.8j) + (expand jrp8k.8k)
$bg = expand jrp2c.2c
$obj = expand jrp2e.2e
$rgb_l = expand a290-27axv-bxhd.9e
$rgb_h = expand a290-27axv-cxhd.9f
$color = expand a290-27axv-axhd.9p
$snd = expand a290-27axv-dxhd.7p

$rom = $prg + $bg + $obj + $rgb_l + $rgb_h + $color + $snd
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
