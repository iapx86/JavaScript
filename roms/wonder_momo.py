#
#	Wonder Momo
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg1 = z.read('wm1_16.f1') + z.read('wm1_1.9c')
    prg2 = z.read('wm1_2.12c')
    bg1 = z.read('wm1_6.7r') + z.read('wm1_7.7s')
    bg2 = z.read('wm1_4.4r') + z.read('wm1_5.4s')
    obj = z.read('wm1_8.12h') + z.read('wm1_9.12k') + z.read('wm1_10.12l') + z.read('wm1_11.12m') + z.read('wm1_12.12p') + z.read('wm1_13.12r') + z.read('wm1_14.12t') + z.read('wm1_15.12u')
    red = z.read('wm1-1.3r')
    blue = z.read('wm1-2.3s')
    bgcolor = z.read('wm1-3.4v')
    objcolor = z.read('wm1-4.5v')
    bgaddr = z.read('wm1-5.6u')
    prg3 = z.read('wm1_3.6b')
    prg3i = z.read('cus60-60a1.mcu')
    pcm = z.read('wm1_17.f3') * 2 + z.read('wm1_18.h3') * 2 + z.read('wm1_19.k3') * 2 + z.read('wm1_20.m3') * 2

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
