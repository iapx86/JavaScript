#
#	Mahjong Pon Chin Kan
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
    prg = merge(z.read('ponchina/u22.bin') + z.read('um2_1_2.u29'), z.read('um2_1_3.u42') + z.read('um2_1_4.u44'))
    gfx = merge(z.read('um2_1_8.u55') + z.read('um2_1_6.u28'), z.read('um2_1_7.u43') + z.read('um2_1_5.u20'))
    voi = z.read('um2_1_9.u56') + z.read('um2_1_10.u63')

rom = prg + gfx + voi

def pngstring(a):
    w = 1024
    img = Image.new('L', (w, ceil(len(a) / w)))
    img.putdata(a)
    buf = BytesIO()
    img.save(buf, 'PNG')
    return b64encode(buf.getvalue())

with open(argv[2], 'wb') as f:
    f.write(b'export const ROM = \'data:image/png;base64,' + pngstring(rom) + b'\';\n')
