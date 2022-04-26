#
#	Jump Bug
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg = z.read('jb1') + z.read('jb2') + z.read('jumpbugb/jb3b') + z.read('jb4') + z.read('jumpbugb/jb5b') + z.read('jumpbugb/jb6b') + z.read('jumpbugb/jb7b')
    bg = z.read('jbl') + z.read('jbn') + z.read('jbm') + z.read('jbi') + z.read('jbk') + z.read('jbj')
    rgb = z.read('l06_prom.bin')

rom = prg + bg + rgb

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
