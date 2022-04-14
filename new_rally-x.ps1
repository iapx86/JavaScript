#
#	New Rally-X
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg = (expand nrx_prg1.1d)[0..0x7ff] + (expand nrx_prg2.1e)[0..0x7ff] + (expand nrx_prg1.1d)[0x800..0xfff] + (expand nrx_prg2.1e)[0x800..0xfff]
$prg += (expand nrx_prg3.1k)[0..0x7ff] + (expand nrx_prg4.1l)[0..0x7ff] + (expand nrx_prg3.1k)[0x800..0xfff] + (expand nrx_prg4.1l)[0x800..0xfff]
$bgobj = (expand nrx_chg1.8e) + (expand nrx_chg2.8d)
$rgb = expand nrx1-1.11n
$color = expand nrx1-7.8p
$snd = expand rx1-5.3p

$rom = $prg + $bgobj + $rgb + $color + $snd
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
