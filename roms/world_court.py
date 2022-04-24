#
#	World Court
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    snd = z.read('wc1_snd0.bin')
    prg = z.read('wc1_prg6.bin') + z.read('wc1_prg7.bin')
    mcu = z.read('cus64-64a1.mcu')
    voi = z.read('wc1_voi0.bin') * 2 + z.read('wc1_voi1.bin')
    chr8 = z.read('wc1_chr8.bin')
    chr = z.read('wc1_chr0.bin') + z.read('wc1_chr1.bin') + z.read('wc1_chr2.bin') + z.read('wc1_chr3.bin')
    obj = z.read('wc1_obj0.bin') + z.read('wc1_obj1.bin') + z.read('wc1_obj2.bin') + z.read('wc1_obj3.bin') * 2

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
