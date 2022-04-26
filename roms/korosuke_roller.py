#
#	Korosuke Roller
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg = z.read('korosuke/kr.6e') + z.read('korosuke/kr.6f') + z.read('korosuke/kr.6h') + z.read('korosuke/kr.6j')
    bg = z.read('korosuke/kr.5e')
    obj = z.read('korosuke/kr.5f')
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
