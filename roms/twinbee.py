#
#	TwinBee
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
    prg1 = merge(z.read('400-a06.15l') + z.read('412-a07.17l'), z.read('400-a04.10l') + z.read('412-a05.12l'))
    prg2 = z.read('400-e03.5l')
    snd = z.read('400-a01.fse') + z.read('400-a02.fse')

rom = prg1 + prg2 + snd

def pngstring(a):
    w = 1024
    img = Image.new('L', (w, ceil(len(a) / w)))
    img.putdata(a)
    buf = BytesIO()
    img.save(buf, 'PNG')
    return b64encode(buf.getvalue())

with open(argv[2], 'wb') as f:
    f.write(b'export const ROM = \'data:image/png;base64,' + pngstring(rom) + b'\';\n')
