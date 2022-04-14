#
#	Fantasy Zone
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = merge ((expand epr-7385a.43) + (expand epr-7386a.42) + (expand epr-7387.41)) ((expand epr-7382a.26) + (expand epr-7383a.25) + (expand epr-7384.24))
$bg = (expand epr-7388.95) + (expand epr-7389.94) + (expand epr-7390.93)
$obj = merge ((expand epr-7396.11) + (expand epr-7397.18) + (expand epr-7398.24)) ((expand epr-7392.10) + (expand epr-7393.17) + (expand epr-7394.23))
$prg2 = expand epr-7535a.12

$rom = $prg1 + $bg + $obj + $prg2
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
