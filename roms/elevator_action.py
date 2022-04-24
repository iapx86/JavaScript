#
#	Elevator Action
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg1 = z.read('ba3__01.2764.ic1') + z.read('ba3__02.2764.ic2') + z.read('ba3__03-1.2764.ic3') + z.read('ba3__04-1.2764.ic6')
    prg2 = z.read('ba3__09.2732.ic70') + z.read('ba3__10.2732.ic71')
    prg3 = z.read('ba3__11.mc68705p3.ic24')
    gfx = z.read('ba3__05.2764.ic4') + z.read('ba3__06.2764.ic5') + z.read('ba3__07.2764.ic9') + z.read('ba3__08.2764.ic10')
    pri = z.read('eb16.ic22')

rom = prg1 + prg2 + prg3 + gfx + pri

def pngstring(a):
    w = 1024
    img = Image.new('L', (w, ceil(len(a) / w)))
    img.putdata(a)
    buf = BytesIO()
    img.save(buf, 'PNG')
    return b64encode(buf.getvalue())

with open(argv[2], 'wb') as f:
    f.write(b'export const ROM = \'data:image/png;base64,' + pngstring(rom) + b'\';\n')
