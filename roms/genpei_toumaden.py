#
#	Genpei ToumaDen
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg1 = z.read('gt1_10b.f1') + z.read('gt1_1b.9c')
    prg2 = z.read('gt1_2.12c')
    bg1 = z.read('gt1_7.7r') + z.read('gt1_6.7s')
    bg2 = z.read('gt1_5.4r') + z.read('gt1_4.4s')
    obj = z.read('gt1_11.12h') + z.read('gt1_12.12k') + z.read('gt1_13.12l') + z.read('gt1_14.12m') + z.read('gt1_15.12p') + z.read('gt1_16.12r') + z.read('gt1_8.12t') * 2 + z.read('gt1_9.12u') * 2
    red = z.read('gt1-1.3r')
    blue = z.read('gt1-2.3s')
    bgcolor = z.read('gt1-3.4v')
    objcolor = z.read('gt1-4.5v')
    bgaddr = z.read('gt1-5.6u')
    prg3 = z.read('gt1_3.6b')
    prg3i = z.read('cus60-60a1.mcu')
    pcm = z.read('gt1_17.f3') + z.read('gt1_18.h3') + z.read('gt1_19.k3')

rom = prg1 + prg2 + bg1 + bg2 + obj + red + blue + bgcolor + objcolor + bgaddr + prg3 + prg3i + pcm

def pngstring(a):
    w = 1024
    img = Image.new('L', (w, ceil(len(a) / w)))
    img.putdata(a)
    buf = BytesIO()
    img.save(buf, 'PNG')
    return b64encode(buf.getvalue())

with open(argv[2], 'wb') as f:
    f.write(b'export const ROM = \'data:image/png;base64,' + pngstring(rom) + b'\';\n')
