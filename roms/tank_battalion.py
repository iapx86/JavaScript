#
#	Tank Battalion
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg = z.read('tb1-1.1a') + z.read('tb1-2.1b') + z.read('tb1-3.1c') + z.read('tb1-4.1d')
    bg = z.read('tb1-5.2k')
    rgb = z.read('bct1-1.l3')

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
