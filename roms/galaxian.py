#
#	Galaxian
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg = z.read('galap1/7f.bin') + z.read('galaxiana/7j.bin') + z.read('galaxiana/7l.bin')
    bg = z.read('1h.bin') + z.read('1k.bin')
    rgb = z.read('6l.bpr')

rom = prg + bg + rgb

def pngstring(a):
    w = 1024
    img = Image.new('L', (w, ceil(len(a) / w)))
    img.putdata(a)
    buf = BytesIO()
    img.save(buf, 'PNG')
    return b64encode(buf.getvalue())

with open(argv[2], 'wb') as f:
    f.write(b'export const ROM = \'data:image/png;base64,' + pngstring(rom) + b'\';\n')
