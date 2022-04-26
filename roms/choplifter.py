#
#	Choplifter
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg1 = z.read('chopliftu/epr-7152.ic90') + z.read('chopliftu/epr-7153.ic91') + z.read('chopliftu/epr-7154.ic92')
    prg2 = z.read('epr-7130.ic126')
    bg = z.read('epr-7127.ic4') + z.read('epr-7128.ic5') + z.read('epr-7129.ic6')
    obj = z.read('epr-7121.ic87') + z.read('epr-7120.ic86') + z.read('epr-7123.ic89') + z.read('epr-7122.ic88')
    red = z.read('pr7119.ic20')
    green = z.read('pr7118.ic14')
    blue = z.read('pr7117.ic8')
    pri = z.read('pr5317.ic28')

rom = prg1 + prg2 + bg + obj + red + green + blue + pri

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
