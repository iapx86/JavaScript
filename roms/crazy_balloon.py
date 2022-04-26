#
#	Crazy Balloon
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg = z.read('cl01.bin') + z.read('cl02.bin') + z.read('cl03.bin') + z.read('cl04.bin') + z.read('cl05.bin') + z.read('cl06.bin')
    bg = z.read('cl07.bin')
    obj = z.read('cl08.bin')

rom = prg + bg + obj

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
