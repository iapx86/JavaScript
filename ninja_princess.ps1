#
#	Ninja Princess
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg1 = (expand nprincesu/epr-6573.129) + (expand nprincesu/epr-6574.130) + (expand nprincesu/epr-6575.131) + (expand nprincesu/epr-6576.132) + (expand nprinces/epr-6616.133) + (expand nprincesu/epr-6578.134)
$prg2 = expand epr-6559.120
$bg = (expand epr-6558.62) + (expand nprinces/epr-6557.61) + (expand epr-6556.64) + (expand nprinces/epr-6555.63) + (expand epr-6554.66) + (expand nprinces/epr-6553.65)
$obj = (expand epr-6546.117) + (expand epr-6548.04) + (expand epr-6547.110) + (expand ninja/epr-6549.05)
$pri = expand pr-5317.76

$rom = $prg1 + $prg2 + $bg + $obj + $pri
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
