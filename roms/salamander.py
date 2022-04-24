#
#	Salamander
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
    prg1 = merge(z.read('587-d02.18b') + z.read('587-c03.17b'), z.read('587-d05.18c') + z.read('587-c06.17c'))
    prg2 = z.read('587-d09.11j')
    vlm = z.read('587-d08.8g')
    snd = z.read('587-c01.10a')

rom = prg1 + prg2 + vlm + snd

def pngstring(a):
    w = 1024
    img = Image.new('L', (w, ceil(len(a) / w)))
    img.putdata(a)
    buf = BytesIO()
    img.save(buf, 'PNG')
    return b64encode(buf.getvalue())

with open(argv[2], 'wb') as f:
    f.write(b'export const ROM = \'data:image/png;base64,' + pngstring(rom) + b'\';\n')
