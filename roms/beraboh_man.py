#
#	Beraboh Man
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    snd = z.read('bm1_s0.bin')
    prg = z.read('bm1_p0.bin') + z.read('bm1_p1.bin') + z.read('bm1_p4.bin') + z.read('bm1-p6.bin') + z.read('bm1_p7c.bin')
    mcu = z.read('cus64-64a1.mcu')
    voi = z.read('bm1_v0.bin') * 2 + z.read('bm_voi-1.bin') + z.read('bm1_v2.bin') * 2
    chr8 = z.read('bm_chr-8.bin')
    chr = z.read('bm_chr-0.bin') + z.read('bm_chr-1.bin') + z.read('bm_chr-2.bin') + z.read('bm_chr-3.bin') + z.read('bm_chr-4.bin') + z.read('bm_chr-5.bin') + z.read('bm_chr-6.bin')
    obj = z.read('bm_obj-0.bin') + z.read('bm_obj-1.bin') + z.read('bm_obj-2.bin') + z.read('bm_obj-3.bin') + z.read('bm_obj-4.bin') + z.read('bm_obj-5.bin') + b'\xff' * 0x20000 + z.read('bm_obj-7.bin')

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
