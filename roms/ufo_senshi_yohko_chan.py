#
#	Ufo Senshi Yohko Chan
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg1 = z.read('epr-11661.90') + z.read('epr-11662.91') + z.read('epr-11663.92')
    key = z.read('317-0064.key')
    prg2 = z.read('epr-11667.126')
    bg = z.read('epr-11664.4') + z.read('epr-11665.5') + z.read('epr-11666.6')
    obj = z.read('epr-11658.87') + z.read('epr-11657.86') + z.read('epr-11660.89') + z.read('epr-11659.88')
    red = z.read('pr11656.20')
    green = z.read('pr11655.14')
    blue = z.read('pr11654.8')
    pri = z.read('pr5317.28')

rom = prg1 + key + prg2 + bg + obj + red + green + blue + pri

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
