#
#	Bosconian
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand bos3_1.3n) + (expand bos1_2.3m) + (expand bos1_3.3l) + (expand bos1_4b.3k)
$prg2 = (expand bos1_5c.3j) + (expand bos3_6.3h)
$prg3 = expand bos1_7.3e
$bg = expand bos1_14.5d
$obj = expand bos1_13.5e
$rgb = expand bos1-6.6b
$bgcolor = expand bos1-5.4m
$snd = expand bos1-1.1d
$voi = (expand bos1_9.5n) + (expand bos1_10.5m) + (expand bos1_11.5k)
$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[1])
$key = expand 50xx.bin
$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[2])
$io = expand 51xx.bin
$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[3])
$prg = expand 54xx.bin

$rom = $prg1 + $prg2 + $prg3 + $bg + $obj + $rgb + $bgcolor + $snd + $voi + $key + $io + $prg
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[4]
