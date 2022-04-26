#
#	Hopping Mappy
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg1 = z.read('hm1_1.9c')
    prg2 = z.read('hm1_2.12c')
    bg1 = z.read('hm1_6.7r')
    bg2 = z.read('hm1_5.4r')
    obj = z.read('hm1_4.12h')
    red = z.read('hm1-1.3r')
    blue = z.read('hm1-2.3s')
    bgcolor = z.read('hm1-3.4v')
    objcolor = z.read('hm1-4.5v')
    bgaddr = z.read('hm1-5.6u')
    prg3 = z.read('hm1_3.6b')
    prg3i = z.read('cus60-60a1.mcu')

rom = prg1 + prg2 + bg1 + bg2 + obj + red + blue + bgcolor + objcolor + bgaddr + prg3 + prg3i

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
