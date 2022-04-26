﻿#
#	Blast Off
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    snd = z.read('bo1-snd0.bin') + z.read('bo1-snd1.bin')
    prg = z.read('bo1_prg6.bin') + z.read('bo1prg7b.bin')
    mcu = z.read('cus64-64a1.mcu')
    voi = z.read('bo_voi-0.bin') + z.read('bo_voi-1.bin') + z.read('bo_voi-2.bin')
    chr8 = z.read('bo_chr-8.bin')
    chr = z.read('bo_chr-0.bin') + z.read('bo_chr-1.bin') + z.read('bo_chr-2.bin') + z.read('bo_chr-3.bin') + z.read('bo_chr-4.bin') + z.read('bo_chr-5.bin') + b'\xff' * 0x20000 + z.read('bo_chr-7.bin')
    obj = z.read('bo_obj-0.bin') + z.read('bo_obj-1.bin') + z.read('bo_obj-2.bin') + z.read('bo_obj-3.bin') + z.read('bo1_obj4.bin')

rom = snd + prg + mcu + voi + chr8 + chr + obj

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
