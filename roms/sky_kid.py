#
#	Sky Kid
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg1 = z.read('sk2_2.6c') + z.read('sk1-1c.6b') + z.read('sk1_3.6d')
    prg2 = z.read('sk2_4.3c')
    prg2i = z.read('cus63-63a1.mcu')
    fg = z.read('sk1_6.6l')
    bg = z.read('sk1_5.7e')
    obj = z.read('sk1_8.10n') + z.read('sk1_7.10m')
    red = z.read('sk1-1.2n')
    green = z.read('sk1-2.2p')
    blue = z.read('sk1-3.2r')
    bgcolor = z.read('sk1-4.5n')
    objcolor = z.read('sk1-5.6n')

rom = prg1 + prg2 + prg2i + fg + bg + obj + red + green + blue + bgcolor + objcolor

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
