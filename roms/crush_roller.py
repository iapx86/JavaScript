#
#	Crush Roller
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg = z.read('crush2/tp1') + z.read('crush2/tp5a') + z.read('crush2/tp2') + z.read('crush2/tp6') + z.read('crush2/tp3') + z.read('crush2/tp7') + z.read('crush2/tp4') + z.read('crush2/tp8')
    bg = z.read('crush2/tpa') + z.read('crush2/tpc')
    obj = z.read('crush2/tpb') + z.read('crush2/tpd')
    rgb = z.read('82s123.7f')
    color = z.read('2s140.4a')
    snd = z.read('82s126.1m')

rom = prg + bg + obj + rgb + color + snd

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
