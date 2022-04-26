#
#	Pac-Land
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg1 = z.read('paclandj/pl6_01.8b') + z.read('paclandj/pl6_02.8d') + z.read('pl1_3.8e') + z.read('pl1_4.8f') + z.read('pl1_5.8h') + z.read('paclandj/pl1_6.8j')
    prg2 = z.read('pl1_7.3e')
    prg2i = z.read('cus60-60a1.mcu')
    fg = z.read('paclandj/pl6_12.6n')
    bg = z.read('paclandj/pl1_13.6t')
    obj = z.read('paclandj/pl1_9b.6f') + z.read('paclandj/pl1_8.6e') + z.read('paclandj/pl1_10b.7e') + z.read('paclandj/pl1_11.7f')
    red = z.read('pl1-2.1t')
    blue = z.read('pl1-1.1r')
    fgcolor = z.read('pl1-5.5t')
    bgcolor = z.read('pl1-4.4n')
    objcolor = z.read('pl1-3.6l')

rom = prg1 + prg2 + prg2i + fg + bg + obj + red + blue + fgcolor + bgcolor + objcolor

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
