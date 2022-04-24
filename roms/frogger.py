#
#	Frogger
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg1 = z.read('frogger.26') + z.read('frogger.27') + z.read('frsm3.7')
    prg2 = z.read('frogger.608') + z.read('frogger.609') + z.read('frogger.610')
    bg = z.read('frogger.607') + z.read('frogger.606')
    rgb = z.read('pr-91.6l')

rom = prg1 + prg2 + bg + rgb

def pngstring(a):
    w = 1024
    img = Image.new('L', (w, ceil(len(a) / w)))
    img.putdata(a)
    buf = BytesIO()
    img.save(buf, 'PNG')
    return b64encode(buf.getvalue())

with open(argv[2], 'wb') as f:
    f.write(b'export const ROM = \'data:image/png;base64,' + pngstring(rom) + b'\';\n')
