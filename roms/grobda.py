#
#	Grobda
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg1 = z.read('gr2-3.1d') + z.read('gr2-2.1c') + z.read('gr2-1.1b')
    prg2 = z.read('gr1-4.1k')
    bg = z.read('gr1-7.3c')
    obj = z.read('gr1-5.3f') + z.read('gr1-6.3e')
    rgb = z.read('gr1-6.4c')
    bgcolor = z.read('gr1-5.4e')
    objcolor = z.read('gr1-4.3l')
    snd = z.read('gr1-3.3m')

rom = prg1 + prg2 + bg + obj + rgb + bgcolor + objcolor + snd

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
