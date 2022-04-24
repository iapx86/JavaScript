#
#	Dragon Spirit
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    snd = z.read('ds1_s0.bin') + z.read('ds1_s1.bin')
    prg = z.read('ds1_p0.bin') + z.read('ds1_p1.bin') + z.read('ds1_p2.bin') + z.read('ds1_p3.bin') + z.read('ds1_p4.bin') + z.read('ds1_p5.bin') + z.read('ds3_p6.bin') + z.read('ds3_p7.bin')
    mcu = z.read('cus64-64a1.mcu')
    voi = z.read('ds1_v0.bin') * 2 + z.read('ds_voi-1.bin') + z.read('ds_voi-2.bin') + z.read('ds_voi-3.bin') + z.read('ds_voi-4.bin')
    chr8 = z.read('ds_chr-8.bin')
    chr = z.read('ds_chr-0.bin') + z.read('ds_chr-1.bin') + z.read('ds_chr-2.bin') + z.read('ds_chr-3.bin') + z.read('ds_chr-4.bin') + z.read('ds_chr-5.bin') + z.read('ds_chr-6.bin') + z.read('ds_chr-7.bin')
    obj = z.read('ds_obj-0.bin') + z.read('ds_obj-1.bin') + z.read('ds_obj-2.bin') + z.read('ds_obj-3.bin') + z.read('ds1_o4.bin') * 2

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
