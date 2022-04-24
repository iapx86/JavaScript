#
#	Lunar Rescue
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg1 = z.read('lrescue.1') + z.read('lrescue.2') + z.read('lrescue.3') + z.read('lrescue.4')
    prg2 = z.read('lrescue.5') + z.read('lrescue.6')
    map = z.read('7643-1.cpu') * 2

rom = prg1 + prg2 + map

def pngstring(a):
    w = 1024
    img = Image.new('L', (w, ceil(len(a) / w)))
    img.putdata(a)
    buf = BytesIO()
    img.save(buf, 'PNG')
    return b64encode(buf.getvalue())

with open(argv[2], 'wb') as f:
    f.write(b'export const ROM = \'data:image/png;base64,' + pngstring(rom) + b'\';\n')
