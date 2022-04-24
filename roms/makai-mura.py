#
#	Makai-Mura
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg1 = z.read('makaimur/10n.rom') + z.read('makaimur/8n.rom') + z.read('makaimur/12n.rom')
    prg2 = z.read('gg2.bin')
    fg = z.read('gg1.bin')
    bg = z.read('gg11.bin') + z.read('gg10.bin') + z.read('gg9.bin') + z.read('gg8.bin') + z.read('gg7.bin') + z.read('gg6.bin')
    obj = z.read('gngbl/19.84472.4n') + z.read('gg16.bin') + z.read('gg15.bin') + b'\xff' * 0x4000 + z.read('gngbl/16.84472.4l') + z.read('gg13.bin') + z.read('gg12.bin') + b'\xff' * 0x4000

rom = prg1 + prg2 + fg + bg + obj

def pngstring(a):
    w = 1024
    img = Image.new('L', (w, ceil(len(a) / w)))
    img.putdata(a)
    buf = BytesIO()
    img.save(buf, 'PNG')
    return b64encode(buf.getvalue())

with open(argv[2], 'wb') as f:
    f.write(b'export const ROM = \'data:image/png;base64,' + pngstring(rom) + b'\';\n')
