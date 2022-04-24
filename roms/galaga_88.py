#
#	Galaga '88
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    snd = z.read('g81_s0.bin') + z.read('g81_s1.bin')
    prg = z.read('g81_p0.bin') + z.read('g81_p1.bin') + z.read('g81_p5.bin') + z.read('galaga88j/g81_p6.bin') + z.read('galaga88j/g81_p7.bin')
    mcu = z.read('cus64-64a1.mcu')
    voi = z.read('g81_v0.bin') * 2 + z.read('g81_v1.bin') * 2 + z.read('g81_v2.bin') * 2 + z.read('g81_v3.bin') * 2 + z.read('g81_v4.bin') * 2 + z.read('g81_v5.bin') * 2
    chr8 = z.read('g8_chr-8.bin')
    chr = z.read('g8_chr-0.bin') + z.read('g8_chr-1.bin') + z.read('g8_chr-2.bin') + z.read('g8_chr-3.bin')
    obj = z.read('g8_obj-0.bin') + z.read('g8_obj-1.bin') + z.read('g8_obj-2.bin') + z.read('g8_obj-3.bin') + z.read('g8_obj-4.bin') + z.read('g8_obj-5.bin')

rom = snd + prg + mcu + voi + chr8 + chr + obj

def pngstring(a):
    w = 1024
    img = Image.new('L', (w, ceil(len(a) / w)))
    img.putdata(a)
    buf = BytesIO()
    img.save(buf, 'PNG')
    return b64encode(buf.getvalue())

with open(argv[2], 'wb') as f:
    f.write(b'export const ROM = \'data:image/png;base64,' + pngstring(rom) + b'\';\n')
