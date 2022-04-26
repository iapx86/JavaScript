#
#	The Return of Ishtar
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg1 = z.read('ri1_2.9d') + z.read('ri1_1c.9c')
    prg2 = z.read('ri1_3.12c')
    bg1 = z.read('ri1_14.7r') + z.read('ri1_15.7s')
    bg2 = z.read('ri1_12.4r') + z.read('ri1_13.4s')
    obj = z.read('ri1_5.12h') + z.read('ri1_6.12k') + z.read('ri1_7.12l') + z.read('ri1_8.12m') + z.read('ri1_9.12p') + z.read('ri1_10.12r') + z.read('ri1_11.12t') + b'\xff' * 0x8000
    red = z.read('ri1-1.3r')
    blue = z.read('ri1-2.3s')
    bgcolor = z.read('ri1-3.4v')
    objcolor = z.read('ri1-4.5v')
    bgaddr = z.read('ri1-5.6u')
    prg3 = z.read('ri1_4.6b')
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
