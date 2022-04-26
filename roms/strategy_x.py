#
#	Strategy X
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg1 = z.read('2c_1.bin') + z.read('2e_2.bin') + z.read('2f_3.bin') + z.read('2h_4.bin') + z.read('2j_5.bin') + z.read('2l_6.bin')
    prg2 = z.read('s1.bin') + z.read('s2.bin')
    bg = z.read('5f_c2.bin') + z.read('5h_c1.bin')
    rgb = z.read('strategy.6e')
    map = z.read('strategy.10k')

rom = prg1 + prg2 + bg + rgb + map

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
