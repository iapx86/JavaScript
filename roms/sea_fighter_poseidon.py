#
#	Sea Fighter Poseidon
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg1 = z.read('a14-01.1') + z.read('a14-02.2') + z.read('a14-03.3') + z.read('a14-04.6') + z.read('a14-05.7')
    prg2 = z.read('a14-10.70') + z.read('a14-11.71')
    prg3 = z.read('a14-12')
    gfx = z.read('a14-06.4') + z.read('a14-07.5') + z.read('a14-08.9') + z.read('a14-09.10')
    pri = z.read('eb16.22')

rom = prg1 + prg2 + prg3 + gfx + pri

def pngstring(a):
    w = 1024
    img = Image.new('L', (w, ceil(len(a) / w)))
    img.putdata(a)
    buf = BytesIO()
    img.save(buf, 'PNG')
    return b64encode(buf.getvalue())

with open(argv[2], 'wb') as f:
    f.write(b'export const ROM = \'data:image/png;base64,' + pngstring(rom) + b'\';\n')
