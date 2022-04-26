#
#	Souko Ban Deluxe
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    snd = z.read('sb1_snd0.bin')
    prg = z.read('sb1_prg0.bin') + z.read('sb1_prg1.bin') + z.read('soukobdx/sb1_prg7.bin')
    mcu = z.read('cus64-64a1.mcu')
    voi = z.read('sb1_voi0.bin') * 2
    chr8 = z.read('sb1_chr8.bin')
    chr = z.read('sb1_chr0.bin') + z.read('sb1_chr1.bin') + z.read('sb1_chr2.bin') + z.read('sb1_chr3.bin')
    obj = z.read('sb1_obj0.bin')

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
