#
#	Super Pac-Man
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg1 = z.read('sp1-2.1c') + z.read('sp1-1.1b')
    prg2 = z.read('spc-3.1k')
    bg = z.read('sp1-6.3c')
    obj = z.read('spv-2.3f')
    rgb = z.read('superpac.4c')
    bgcolor = z.read('superpac.4e')
    objcolor = z.read('superpac.3l')
    snd = z.read('superpac.3m')

rom = prg1 + prg2 + bg + obj + rgb + bgcolor + objcolor + snd

def pngstring(a):
    w = 1024
    img = Image.new('L', (w, ceil(len(a) / w)))
    img.putdata(a)
    buf = BytesIO()
    img.save(buf, 'PNG')
    return b64encode(buf.getvalue())

with open(argv[2], 'wb') as f:
    f.write(b'export const ROM = \'data:image/png;base64,' + pngstring(rom) + b'\';\n')
