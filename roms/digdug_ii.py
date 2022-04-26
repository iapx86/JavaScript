#
#	DigDug II
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg1 = z.read('d23_3.1d') + z.read('d23_1.1b')
    prg2 = z.read('d21_4.1k')
    bg = z.read('d21_5.3b')
    obj = z.read('d21_7.3n') + z.read('d21_6.3m')
    rgb = z.read('d21-5.5b')
    bgcolor = z.read('d21-6.4c')
    objcolor = z.read('d21-7.5k')
    snd = z.read('d21-3.3m')

rom = prg1 + prg2 + bg + obj + rgb + bgcolor + objcolor + snd

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
