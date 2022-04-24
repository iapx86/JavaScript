#
#	Super Real Mahjong Part 2
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

def merge(even, odd):
    ret = bytearray(len(even) * 2)
    ret[0::2] = even
    ret[1::2] = odd
    return bytes(ret)

with ZipFile(argv[1]) as z:
    prg = merge(z.read('uco-2.17'), z.read('uco-3.18'))
    gfx = z.read('ubo-4.60') + z.read('ubo-5.61') + merge(z.read('uco-8.64'), z.read('uco-9.65')) + z.read('ubo-6.62') + z.read('ubo-7.63') + merge(z.read('uco-10.66'), z.read('uco-11.67'))
    voi = z.read('uco-1.19')
    color_h = z.read('uc-1o.12')
    color_l = z.read('uc-2o.13')

rom = prg + gfx + voi + color_h + color_l

def pngstring(a):
    w = 1024
    img = Image.new('L', (w, ceil(len(a) / w)))
    img.putdata(a)
    buf = BytesIO()
    img.save(buf, 'PNG')
    return b64encode(buf.getvalue())

with open(argv[2], 'wb') as f:
    f.write(b'export const ROM = \'data:image/png;base64,' + pngstring(rom) + b'\';\n')
