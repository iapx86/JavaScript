#
#	Sky Kid Deluxe
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg1 = z.read('sk3_2.9d') + z.read('sk3_1b.9c')
    prg2 = z.read('sk3_3.12c')
    bg1 = z.read('sk3_9.7r') + z.read('sk3_10.7s')
    bg2 = z.read('sk3_7.4r') + z.read('sk3_8.4s')
    obj = z.read('sk3_5.12h') + z.read('sk3_6.12k')
    red = z.read('sk3-1.3r')
    blue = z.read('sk3-2.3s')
    bgcolor = z.read('sk3-3.4v')
    objcolor = z.read('sk3-4.5v')
    bgaddr = z.read('sk3-5.6u')
    prg3 = z.read('sk3_4.6b')
    prg3i = z.read('cus60-60a1.mcu')

rom = prg1 + prg2 + bg1 + bg2 + obj + red + blue + bgcolor + objcolor + bgaddr + prg3 + prg3i

def pngstring(a):
    w = 1024
    img = Image.new('L', (w, ceil(len(a) / w)))
    img.putdata(a)
    buf = BytesIO()
    img.save(buf, 'PNG')
    return b64encode(buf.getvalue())

with open(argv[2], 'wb') as f:
    f.write(b'export const ROM = \'data:image/png;base64,' + pngstring(rom) + b'\';\n')
