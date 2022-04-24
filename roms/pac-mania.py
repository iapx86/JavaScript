#
#	Pac-Mania
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    snd = z.read('pacmaniaj/pn1_s0.bin') + z.read('pacmaniaj/pn1_s1.bin')
    prg = z.read('pn_prg-6.bin') + z.read('pacmaniaj/pn1_p7.bin')
    mcu = z.read('cus64-64a1.mcu')
    voi = z.read('pacmaniaj/pn1_v0.bin') * 2
    chr8 = z.read('pn2_c8.bin')
    chr = z.read('pn_chr-0.bin') + z.read('pn_chr-1.bin') + z.read('pn_chr-2.bin') + z.read('pn_chr-3.bin')
    obj = z.read('pn_obj-0.bin') + z.read('pacmaniaj/pn_obj-1.bin')

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
