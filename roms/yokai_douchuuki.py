#
#	Yokai Douchuuki
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    snd = z.read('yd1_s0.bin') + z.read('yd1_s1.bin')
    prg = z.read('yd1_p0.bin') + z.read('yd1_p1.bin') + z.read('yd1_p2.bin') + z.read('yd1_p3.bin') + z.read('yd1_p5.bin') + z.read('youkaidk1/yd1_p6.bin') + z.read('youkaidk2/yd2_p7b.bin')
    mcu = z.read('cus64-64a1.mcu')
    voi = z.read('yd_voi-0.bin') + z.read('yd_voi-1.bin') + z.read('yd_voi-2.bin')
    chr8 = z.read('yd_chr-8.bin')
    chr = z.read('yd_chr-0.bin') + z.read('yd_chr-1.bin') + z.read('yd_chr-2.bin') + z.read('yd_chr-3.bin') + z.read('yd_chr-4.bin') + z.read('yd_chr-5.bin') + z.read('yd_chr-6.bin') + z.read('yd_chr-7.bin')
    obj = z.read('yd_obj-0.bin') + z.read('yd_obj-1.bin') + z.read('yd_obj-2.bin') + z.read('yd_obj-3.bin') + z.read('yd_obj-4.bin')

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
