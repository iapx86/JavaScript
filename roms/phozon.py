#
#	Phozon
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg1 = z.read('6e.rom') + z.read('6h.rom') + z.read('6c.rom') + z.read('6d.rom')
    prg2 = z.read('3b.rom')
    prg3 = z.read('9r.rom')
    bg = z.read('7j.rom') + z.read('8j.rom')
    obj = z.read('5t.rom')
    red = z.read('red.prm')
    green = z.read('green.prm')
    blue = z.read('blue.prm')
    bgcolor = z.read('chr.prm')
    objcolor = z.read('sprite.prm')
    snd = z.read('sound.prm')

rom = prg1 + prg2 + prg3 + bg + obj + red + green + blue + bgcolor + objcolor + snd

def pngstring(a):
    w = 1024
    img = Image.new('L', (w, ceil(len(a) / w)))
    img.putdata(a)
    buf = BytesIO()
    img.save(buf, 'PNG')
    return b64encode(buf.getvalue())

with open(argv[2], 'wb') as f:
    f.write(b'export const ROM = \'data:image/png;base64,' + pngstring(rom) + b'\';\n')
