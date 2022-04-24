#
#	X68000
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    rom = z.read('cgrom.dat') + z.read('iplrom.dat')

def pngstring(a):
    w = 1024
    img = Image.new('L', (w, ceil(len(a) / w)))
    img.putdata(a)
    buf = BytesIO()
    img.save(buf, 'PNG')
    return b64encode(buf.getvalue())

with open(argv[-1], 'wb') as f:
    f.write(b'export const ROM = \'data:image/png;base64,' + pngstring(rom) + b'\';\n')
for i in range(2, len(argv) - 1):
    with open(argv[i], 'rb') as f:
        disk = f.read()
    with open(argv[-1], 'ab') as f:
        f.write(b'export const DISK' + str(i - 1).encode() + b' = \'data:image/png;base64,' + pngstring(disk) + b'\';\n')
