#
#	Mahjong Pon Chin Kan
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    merge = lambda even, odd : bytes([odd[i // 2] if i % 2 else even[i // 2] for i in range(len(even) * 2)])
    prg = merge(z.read('ponchina/u22.bin') + z.read('um2_1_2.u29'), z.read('um2_1_3.u42') + z.read('um2_1_4.u44'))
    gfx = merge(z.read('um2_1_8.u55') + z.read('um2_1_6.u28'), z.read('um2_1_7.u43') + z.read('um2_1_5.u20'))
    voi = z.read('um2_1_9.u56') + z.read('um2_1_10.u63')

rom = prg + gfx + voi

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
