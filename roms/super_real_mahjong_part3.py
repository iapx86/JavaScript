#
#	Super Real Mahjong Part 3
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    merge = lambda even, odd : bytes([odd[i // 2] if i % 2 else even[i // 2] for i in range(len(even) * 2)])
    prg = z.read('za0-10.bin')
    gfx = merge(z.read('za0-02.bin') + z.read('za0-01.bin') + z.read('za0-06.bin') + z.read('za0-05.bin'), z.read('za0-04.bin') + z.read('za0-03.bin') + z.read('za0-08.bin') + z.read('za0-07.bin'))
    voi = z.read('za0-11.bin')
    color_h = z.read('za0-12.prm')
    color_l = z.read('za0-13.prm')

rom = prg + gfx + voi + color_h + color_l

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
