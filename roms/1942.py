#
#	1942
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg1 = z.read('srb-03.m3') + z.read('srb-04.m4') + z.read('srb-05.m5') + z.read('srb-06.m6') + b'\xff' * 0x2000 + z.read('srb-07.m7') + b'\xff' * 0x4000
    prg2 = z.read('sr-01.c11')
    fg = z.read('sr-02.f2')
    bg = z.read('sr-08.a1') + z.read('sr-09.a2') + z.read('sr-10.a3') + z.read('sr-11.a4') + z.read('sr-12.a5') + z.read('sr-13.a6')
    obj = z.read('sr-14.l1') + z.read('sr-15.l2') + z.read('sr-16.n1') + z.read('sr-17.n2')
    red = z.read('sb-5.e8')
    green = z.read('sb-6.e9')
    blue = z.read('sb-7.e10')
    fgcolor = z.read('sb-0.f1')
    bgcolor = z.read('sb-4.d6')
    objcolor = z.read('sb-8.k3')

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
