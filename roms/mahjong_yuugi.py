#
#	Mahjong Yuugi
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    merge = lambda even, odd : bytes([odd[i // 2] if i % 2 else even[i // 2] for i in range(len(even) * 2)])
    prg = merge(z.read('mjyuugia/um_001.001') + z.read('um001.002'), z.read('um001.003') + z.read('um001.004'))
    gfx = merge(z.read('maj-001.10') + z.read('maj-001.09') + z.read('maj-001.06') + z.read('maj-001.05'), z.read('maj-001.08') + z.read('maj-001.07') + z.read('maj-001.04') + z.read('maj-001.03'))
    voi = z.read('maj-001.01') + z.read('maj-001.02')

rom = prg + gfx + voi

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
