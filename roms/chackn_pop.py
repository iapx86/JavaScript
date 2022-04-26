#
#	Chack'n Pop
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg1 = z.read('ao4_01.ic28') + z.read('ao4_02.ic27') + z.read('ao4_03.ic26') + z.read('ao4_04.ic25') + z.read('ao4_05.ic3')
    prg2 = z.read('ao4_06.ic23')
    obj = z.read('ao4_08.ic14') + z.read('ao4_07.ic15')
    bg = z.read('ao4_09.ic98') + z.read('ao4_10.ic97')
    rgb_l = z.read('ao4-11.ic96')
    rgb_h = z.read('ao4-12.ic95')

rom = prg1 + prg2 + obj + bg + rgb_l + rgb_h

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
