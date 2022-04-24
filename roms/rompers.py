#
#	Rompers
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    snd = z.read('rp1_snd0.bin')
    prg = z.read('rp1_prg4.bin') + z.read('rp1_prg5.bin') + z.read('rp1prg6b.bin') + z.read('rp1prg7b.bin')
    mcu = z.read('cus64-64a1.mcu')
    voi = z.read('rp_voi-0.bin')
    chr8 = z.read('rp1_chr8.bin')
    chr = z.read('rp_chr-0.bin') + z.read('rp_chr-1.bin') + z.read('rp_chr-2.bin') + z.read('rp_chr-3.bin')
    obj = z.read('rp_obj-0.bin') + z.read('rp_obj-1.bin') + z.read('rp_obj-2.bin') + z.read('rp_obj-3.bin') + z.read('rp_obj-4.bin') + z.read('rp1_obj5.bin') + z.read('rp1_obj6.bin')

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
