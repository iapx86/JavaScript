#
#	Pac-Man
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg = z.read('pm1_prg1.6e') + z.read('pm1_prg2.6k') + z.read('pm1_prg3.6f') + z.read('pm1_prg4.6m') + z.read('pm1_prg5.6h') + z.read('pm1_prg6.6n') + z.read('pm1_prg7.6j') + z.read('pm1_prg8.6p')
    bg = z.read('pm1_chg1.5e') + z.read('pm1_chg2.5h')
    obj = z.read('pm1_chg3.5f') + z.read('pm1_chg4.5j')
    rgb = z.read('pm1-1.7f')
    color = z.read('pm1-4.4a')
    snd = z.read('pm1-3.1m')

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
