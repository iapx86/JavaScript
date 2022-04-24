#
#	The NewZealand Story
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg1 = z.read('b53-24.u1')
    prg2 = z.read('tnzsj/b53-27.u3')
    prg3 = z.read('b53-26.u34')
    gfx = z.read('b53-16.ic7') + z.read('b53-17.ic8') + z.read('b53-18.ic9') + z.read('b53-19.ic10') + z.read('b53-22.ic11') + z.read('b53-23.ic13') + z.read('b53-20.ic12') + z.read('b53-21.ic14')

rom = prg1 + prg2 + prg3 + gfx

def pngstring(a):
    w = 1024
    img = Image.new('L', (w, ceil(len(a) / w)))
    img.putdata(a)
    buf = BytesIO()
    img.save(buf, 'PNG')
    return b64encode(buf.getvalue())

with open(argv[2], 'wb') as f:
    f.write(b'export const ROM = \'data:image/png;base64,' + pngstring(rom) + b'\';\n')
