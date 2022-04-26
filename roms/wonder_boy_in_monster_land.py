#
#	Wonder Boy in Monster Land
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg1 = z.read('epr-11031a.90') + z.read('epr-11032.91') + z.read('epr-11033.92')
    key = z.read('317-0043.key')
    prg2 = z.read('epr-11037.126')
    bg = z.read('epr-11034.4') + z.read('epr-11035.5') + z.read('epr-11036.6')
    obj = z.read('epr-11028.87') + z.read('epr-11027.86') + z.read('epr-11030.89') + z.read('epr-11029.88')
    red = z.read('pr11026.20')
    green = z.read('pr11025.14')
    blue = z.read('pr11024.8')
    pri = z.read('pr5317.37')

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
