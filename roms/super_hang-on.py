#
#	Super Hang-On
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg3 = z.read('epr-10649c.88')
    pcm = z.read('epr-10643.66') * 2 + z.read('epr-10644.67') * 2 + z.read('epr-10645.68') * 2 + z.read('epr-10646.69') * 2 + b'\xff' * 0x40000

rom = prg3 + pcm

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
