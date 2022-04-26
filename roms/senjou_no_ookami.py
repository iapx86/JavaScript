#
#	Senjou no Ookami
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg1 = z.read('commandoj/so04.9m') + z.read('commandoj/so03.8m')
    prg2 = z.read('commandob2/8,so02.9f')
    fg = z.read('vt01.5d')
    bg = z.read('vt11.5a') + z.read('vt12.6a') + z.read('vt13.7a') + z.read('vt14.8a') + z.read('vt15.9a') + z.read('vt16.10a')
    obj = z.read('vt05.7e') + z.read('vt06.8e') + z.read('vt07.9e') + b'\xff' * 0x4000 + z.read('vt08.7h') + z.read('vt09.8h') + z.read('vt10.9h') + b'\xff' * 0x4000
    red = z.read('vtb1.1d')
    green = z.read('vtb2.2d')
    blue = z.read('vtb3.3d')

rom = prg1 + prg2 + fg + bg + obj + red + green + blue

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
