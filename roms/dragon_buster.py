#
#	Dragon Buster
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg1 = z.read('db1_2b.6c') + z.read('db1_1.6b') + z.read('db1_3.6d')
    prg2 = z.read('db1_4.3c')
    prg2i = z.read('cus60-60a1.mcu')
    fg = z.read('db1_6.6l')
    bg = z.read('db1_5.7e')
    obj = z.read('db1_8.10n') + z.read('db1_7.10m')
    red = z.read('db1-1.2n')
    green = z.read('db1-2.2p')
    blue = z.read('db1-3.2r')
    bgcolor = z.read('db1-4.5n')
    objcolor = z.read('db1-5.6n')

rom = prg1 + prg2 + prg2i + fg + bg + obj + red + green + blue + bgcolor + objcolor

def pngstring(a):
    w = 1024
    img = Image.new('L', (w, ceil(len(a) / w)))
    img.putdata(a)
    buf = BytesIO()
    img.save(buf, 'PNG')
    return b64encode(buf.getvalue())

with open(argv[2], 'wb') as f:
    f.write(b'export const ROM = \'data:image/png;base64,' + pngstring(rom) + b'\';\n')
