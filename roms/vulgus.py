#
#	Vulgus
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg1 = z.read('vulgus.002') + z.read('vulgus.003') + z.read('vulgus.004') + z.read('vulgus.005') + z.read('1-8n.bin')
    prg2 = z.read('1-11c.bin')
    fg = z.read('1-3d.bin')
    bg = z.read('2-2a.bin') + z.read('2-3a.bin') + z.read('2-4a.bin') + z.read('2-5a.bin') + z.read('2-6a.bin') + z.read('2-7a.bin')
    obj = z.read('2-2n.bin') + z.read('2-3n.bin') + z.read('2-4n.bin') + z.read('2-5n.bin')
    red = z.read('e8.bin')
    green = z.read('e9.bin')
    blue = z.read('e10.bin')
    fgcolor = z.read('d1.bin')
    bgcolor = z.read('c9.bin')
    objcolor = z.read('j2.bin')

rom = prg1 + prg2 + fg + bg + obj + red + green + blue + fgcolor + bgcolor + objcolor

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
