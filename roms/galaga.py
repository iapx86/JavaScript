#
#	Galaga
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg1 = z.read('gg1_1b.3p') + z.read('gg1_2b.3m') + z.read('gg1_3.2m') + z.read('gg1_4b.2l')
    prg2 = z.read('gg1_5b.3f')
    prg3 = z.read('gg1_7b.2c')
    bg = z.read('gg1_9.4l')
    obj = z.read('gg1_11.4d') + z.read('gg1_10.4f')
    rgb = z.read('prom-5.5n')
    bgcolor = z.read('prom-4.2n')
    objcolor = z.read('prom-3.1c')
    snd = z.read('prom-1.1d')
with ZipFile(argv[2]) as z:
    io = z.read('51xx.bin')
with ZipFile(argv[3]) as z:
    prg = z.read('54xx.bin')

rom = prg1 + prg2 + prg3 + bg + obj + rgb + bgcolor + objcolor + snd + io + prg

def pngstring(a):
    w = 1024
    img = Image.new('L', (w, ceil(len(a) / w)))
    img.putdata(a)
    buf = BytesIO()
    img.save(buf, 'PNG')
    return b64encode(buf.getvalue())

with open(argv[4], 'wb') as f:
    f.write(b'export const ROM = \'data:image/png;base64,' + pngstring(rom) + b'\';\n')
