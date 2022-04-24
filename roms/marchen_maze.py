#
#	Marchen Maze
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    snd = z.read('mm_snd-0.bin') + z.read('mm_snd-1.bin')
    prg = z.read('mm_prg-0.bin') + z.read('mm_prg-1.bin') + z.read('mm_prg-2.bin') + z.read('mm1_p6.bin') + z.read('mm1_p7.bin')
    mcu = z.read('cus64-64a1.mcu')
    voi = z.read('mm_voi-0.bin') + z.read('mm_voi-1.bin')
    chr8 = z.read('mm_chr-8.bin')
    chr = z.read('mm_chr-0.bin') + z.read('mm_chr-1.bin') + z.read('mm_chr-2.bin') + z.read('mm_chr-3.bin') + z.read('mm_chr-4.bin') + z.read('mm_chr-5.bin')
    obj = z.read('mm_obj-0.bin') + z.read('mm_obj-1.bin') + z.read('mm_obj-2.bin') + z.read('mm_obj-3.bin')
    nvram = z.read('mmaze.nv')

rom = snd + prg + mcu + voi + chr8 + chr + obj + nvram

def pngstring(a):
    w = 1024
    img = Image.new('L', (w, ceil(len(a) / w)))
    img.putdata(a)
    buf = BytesIO()
    img.save(buf, 'PNG')
    return b64encode(buf.getvalue())

with open(argv[2], 'wb') as f:
    f.write(b'export const ROM = \'data:image/png;base64,' + pngstring(rom) + b'\';\n')
