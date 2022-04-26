#
#	Libble Rabble
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    merge = lambda even, odd : bytes([odd[i // 2] if i % 2 else even[i // 2] for i in range(len(even) * 2)])
    prg1 = z.read('5b.rom') + z.read('5c.rom')
    prg2 = z.read('2c.rom')
    prg3 = merge(z.read('8c.rom'), z.read('10c.rom'))
    bg = z.read('5p.rom')
    obj = z.read('9t.rom')
    red = z.read('lr1-3.1r')
    green = z.read('lr1-2.1s')
    blue = z.read('lr1-1.1t')
    bgcolor = z.read('lr1-5.5l')
    objcolor = z.read('lr1-6.2p')
    snd = z.read('lr1-4.3d')

rom = prg1 + prg2 + prg3 + bg + obj + red + green + blue + bgcolor + objcolor + snd

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
