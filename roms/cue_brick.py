#
#	Cue Brick
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
    prg1 = merge(z.read('cuebrickj/903_e05.6n') + z.read('cuebrickj/903_e09.6r'), z.read('cuebrickj/903_e04.4n') + z.read('cuebrickj/903_e08.4r'))
    prg2 = merge(z.read('cuebrickj/903_d07.10n') + z.read('cuebrickj/903_e13.10s'), z.read('cuebrickj/903_d06.8n') + z.read('cuebrickj/903_e12.8s'))
    prg3 = z.read('cuebrickj/903_d03.10a')
    bg = z.read('cuebrickj/903_e14.d8')
    data = merge(z.read('cuebrickj/903_e11.10r'), z.read('cuebrickj/903_e10.8r'))

rom = prg1 + prg2 + prg3 + bg + data

def pngstring(a):
    w = 1024
    img = Image.new('L', (w, ceil(len(a) / w)))
    img.putdata(a)
    buf = BytesIO()
    img.save(buf, 'PNG')
    return b64encode(buf.getvalue())

with open(argv[2], 'wb') as f:
    f.write(b'export const ROM = \'data:image/png;base64,' + pngstring(rom) + b'\';\n')
