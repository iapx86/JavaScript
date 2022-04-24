#
#	Tetris
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

def merge(even, odd):
    ret = bytearray(len(even) * 2)
    ret[0::2] = even
    ret[1::2] = odd
    return bytes(ret)

with ZipFile(argv[1]) as z:
    prg1 = merge(z.read('epr-12201.rom'), z.read('epr-12200.rom'))
    key = z.read('317-0093.key')
    bg = z.read('epr-12202.rom') + z.read('epr-12203.rom') + z.read('epr-12204.rom')
    obj = merge(z.read('epr-12170.b5'), z.read('epr-12169.b1'))
    prg2 = z.read('epr-12205.rom')

rom = prg1 + key + bg + obj + prg2

def pngstring(a):
    w = 1024
    img = Image.new('L', (w, ceil(len(a) / w)))
    img.putdata(a)
    buf = BytesIO()
    img.save(buf, 'PNG')
    return b64encode(buf.getvalue())

with open(argv[2], 'wb') as f:
    f.write(b'export const ROM = \'data:image/png;base64,' + pngstring(rom) + b'\';\n')
