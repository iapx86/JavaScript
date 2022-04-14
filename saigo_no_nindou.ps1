#
#	Saigo no Nindou
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg = merge ((expand nspiritj/nin_c-l0.6d) + (expand nin_c-l1.6c) + (expand nin_c-l2.6b) + (expand nspiritj/nin_c-l3.6a)) ((expand nspiritj/nin_c-h0.6h) + (expand nin_c-h1.6j) + (expand nin_c-h2.6l) + (expand nspiritj/nin_c-h3.6m))

$rom = $prg
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
