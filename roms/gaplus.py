#
#	Gaplus
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg1 = z.read('gp2-4.8d') + z.read('gp2-3b.8c') + z.read('gp2-2b.8b')
    prg2 = z.read('gp2-8.11d') + z.read('gp2-7.11c') + z.read('gp2-6.11b')
    prg3 = z.read('gp2-1.4b')
    bg = z.read('gp2-5.8s')
    obj = z.read('gp2-11.11p') + z.read('gp2-10.11n') + z.read('gp2-9.11m') + z.read('gp2-12.11r')
    red = z.read('gp2-3.1p')
    green = z.read('gp2-1.1n')
    blue = z.read('gp2-2.2n')
    bgcolor = z.read('gp2-7.6s')
    objcolor_l = z.read('gp2-6.6p')
    objcolor_h = z.read('gp2-5.6n')
    snd = z.read('gp2-4.3f')
with ZipFile(argv[2]) as z:
    prg = z.read('62xx.bin')

rom = prg1 + prg2 + prg3 + bg + obj + red + green + blue + bgcolor + objcolor_l + objcolor_h + snd + prg

def pngstring(a):
    w = 1024
    img = Image.new('L', (w, ceil(len(a) / w)))
    img.putdata(a)
    buf = BytesIO()
    img.save(buf, 'PNG')
    return b64encode(buf.getvalue())

with open(argv[3], 'wb') as f:
    f.write(b'export const ROM = \'data:image/png;base64,' + pngstring(rom) + b'\';\n')
