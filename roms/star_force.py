#
#	Star Force
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg1 = z.read('3.3p') + z.read('2.3mn')
    prg2 = z.read('1.3hj')
    fg = z.read('7.2fh') + z.read('8.3fh') + z.read('9.3fh')
    bg1 = z.read('15.10jk') + z.read('14.9jk') + z.read('13.8jk')
    bg2 = z.read('12.10de') + z.read('11.9de') + z.read('10.8de')
    bg3 = z.read('18.10pq') + z.read('17.9pq') + z.read('16.8pq')
    obj = z.read('6.10lm') + z.read('5.9lm') + z.read('4.8lm')
    snd = z.read('07b.bin')

rom = prg1 + prg2 + fg + bg1 + bg2 + bg3 + obj + snd

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
