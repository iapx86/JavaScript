#
#	X Multiply
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg = merge ((expand xmultiplm72/xm_c-l3-.ic34) + (expand xmultiplm72/xm_c-l0-.ic37)) ((expand xmultiplm72/xm_c-h3-.ic43) + (expand xmultiplm72/xm_c-h0-.ic40))

$rom = $prg
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
