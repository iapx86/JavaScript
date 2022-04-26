#
#	Zig Zag
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg = z.read('zz_d1.7l') + z.read('zz_d2.7k') + z.read('zz_d4.7f') + z.read('zz_d3.7h')
    bg = z.read('zz_6.1h')[:0x800] + z.read('zz_5.1k')[:0x800]
    obj = z.read('zz_6.1h')[0x800:] + z.read('zz_5.1k')[0x800:]
    rgb = z.read('zzbpr_e9.bin')

rom = prg + bg + obj + rgb

def pngstring(a):
    w = 1024
    img = Image.new('P', (w, ceil(len(a) / w)))
    img.putpalette(sum([[i, 0, 0] for i in range(256)], []))
    img.putdata(a)
    buf = BytesIO()
    img.save(buf, 'PNG')
    return b64encode(buf.getvalue())

with open(argv[2], 'wb') as f:
    f.write(b'export const ROM = \'data:image/png;base64,' + pngstring(rom) + b'\';\n')
