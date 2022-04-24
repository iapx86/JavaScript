#
#	Pac & Pal
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg1 = z.read('pap1-3b.1d') + z.read('pap1-2b.1c') + z.read('pap3-1.1b')
    prg2 = z.read('pap1-4.1k')
    bg = z.read('pap1-6.3c')
    obj = z.read('pap1-5.3f')
    rgb = z.read('pap1-6.4c')
    bgcolor = z.read('pap1-5.4e')
    objcolor = z.read('pap1-4.3l')
    snd = z.read('pap1-3.3m')

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
