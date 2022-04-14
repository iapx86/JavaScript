#
#	R-Type
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$prg = merge ((expand rtypej/rt_r-l0-.3b) + (expand rtypej/rt_r-l1-.3c)) ((expand rtypej/rt_r-h0-.1b) + (expand rtypej/rt_r-h1-.1c))
$obj = (expand rt_r-00.1h) + (expand rt_r-01.1j) * 2 + (expand rt_r-10.1k) + (expand rt_r-11.1l) * 2 + (expand rt_r-20.3h) + (expand rt_r-21.3j) * 2 + (expand rt_r-30.3k) + (expand rt_r-31.3l) * 2
$bg1 = (expand rt_b-a0.3c) + (expand rt_b-a1.3d) + (expand rt_b-a2.3a) + (expand rt_b-a3.3e)
$bg2 = (expand rt_b-b0.3j) + (expand rt_b-b1.3k) + (expand rt_b-b2.3h) + (expand rt_b-b3.3f)

$rom = $prg + $obj + $bg1 + $bg2
Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[1]
