#
#	Tank Force
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    snd = z.read('tf1_snd0.bin')
    prg = z.read('tf1_prg0.bin') + z.read('tf1_prg1.bin') + z.read('tankfrcej/tf1_prg7.bin')
    mcu = z.read('cus64-64a1.mcu')
    voi = z.read('tf1_voi0.bin') + z.read('tf1_voi1.bin')
    chr8 = z.read('tf1_chr8.bin')
    chr = z.read('tf1_chr0.bin') + z.read('tf1_chr1.bin') + z.read('tf1_chr2.bin') + z.read('tf1_chr3.bin') + z.read('tf1_chr4.bin') + z.read('tf1_chr5.bin')
    obj = z.read('tf1_obj0.bin') + z.read('tf1_obj1.bin')

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
