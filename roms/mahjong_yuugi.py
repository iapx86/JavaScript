#
#	Mahjong Yuugi
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
    prg = merge(z.read('mjyuugia/um_001.001') + z.read('um001.002'), z.read('um001.003') + z.read('um001.004'))
    gfx = merge(z.read('maj-001.10') + z.read('maj-001.09') + z.read('maj-001.06') + z.read('maj-001.05'), z.read('maj-001.08') + z.read('maj-001.07') + z.read('maj-001.04') + z.read('maj-001.03'))
    voi = z.read('maj-001.01') + z.read('maj-001.02')

rom = prg + gfx + voi

def pngstring(a):
    w = 1024
    img = Image.new('L', (w, ceil(len(a) / w)))
    img.putdata(a)
    buf = BytesIO()
    img.save(buf, 'PNG')
    return b64encode(buf.getvalue())

with open(argv[2], 'wb') as f:
    f.write(b'export const ROM = \'data:image/png;base64,' + pngstring(rom) + b'\';\n')
