#
#	Scramble
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg1 = z.read('s1.2d') + z.read('s2.2e') + z.read('s3.2f') + z.read('s4.2h') + z.read('s5.2j') + z.read('s6.2l') + z.read('s7.2m') + z.read('s8.2p')
    prg2 = z.read('ot1.5c') + z.read('ot2.5d') + z.read('ot3.5e')
    bg = z.read('c2.5f') + z.read('c1.5h')
    rgb = z.read('c01s.6e')

rom = prg1 + prg2 + bg + rgb

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
