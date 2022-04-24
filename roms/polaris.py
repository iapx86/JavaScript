#
#	Polaris
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg1 = z.read('ps01-1.ic71') + z.read('ps02-9.ic70') + z.read('ps03-1.ic69') + z.read('ps04-18.ic62')
    prg2 = z.read('ps05.ic61') + z.read('ps06-10.ic60') + z.read('ps26.ic60a')
    map = z.read('ps08.1b')
    obj = z.read('ps07.2c')

rom = prg1 + prg2 + map + obj

def pngstring(a):
    w = 1024
    img = Image.new('L', (w, ceil(len(a) / w)))
    img.putdata(a)
    buf = BytesIO()
    img.save(buf, 'PNG')
    return b64encode(buf.getvalue())

with open(argv[2], 'wb') as f:
    f.write(b'export const ROM = \'data:image/png;base64,' + pngstring(rom) + b'\';\n')
