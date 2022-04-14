#
#	X68000
#

. ./common.ps1

$zip = [System.IO.Compression.ZipFile]::OpenRead($Args[0])
$rom = (expand cgrom.dat) + (expand iplrom.dat)

Write-Output $rom -NoEnumerate | pngString ROM | Set-Content $Args[$Args.Length  - 1]
for ($i = 1; $i -lt $Args.Length - 1; $i += 1) {
	Get-Content $Args[$i] -Encoding Byte -ReadCount 0 | pngString DISK$i | Add-Content $Args[$Args.Length  - 1]
}
