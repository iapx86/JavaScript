#
#	common functions
#

Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.Drawing

function expand($name) {
	$entry = $zip.GetEntry($name)
	$array = New-Object System.Byte[] $entry.Length
	[Void]$entry.Open().Read($array, 0, $array.Length)
	return $array
}

function merge($even, $odd) {
	for ($i = 0; $i -lt $even.Length; $i += 1) {
		$even[$i]
		$odd[$i]
	}
}

function pngString($var) {
	begin { $buf = @() }
	process { $buf += $_ }
	end {
		$size = $buf.Length
		$w = 1024
		$h = [Math]::Ceiling($size / $w);
		$img = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format8bppIndexed)
		$pal = $img.Palette
		for ($i = 0; $i -lt 256; $i += 1) {$pal.Entries[$i] = [System.Drawing.Color]::FromArgb($i, $i, $i)}
		$img.Palette = $pal
		$rect = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
		$data = $img.LockBits($rect, "WriteOnly", $img.PixelFormat)
		[System.Runtime.InteropServices.Marshal]::Copy($buf, 0, $data.Scan0, $size)
		$img.UnlockBits($data)
		$temp = New-TemporaryFile
		$img.Save($temp)
		$img.Dispose()
		$str = [convert]::ToBase64String([System.IO.File]::ReadAllBytes($temp))
		Remove-Item -Path $temp
		"export const $var = 'data:image/png;base64,`\"
		for ($i = 0; $str.Length - $i -gt 120; $i += 120) {$str.Substring($i, 120) + '\'}
		$str.Substring($i) + '\'
		''';'
	}
}

