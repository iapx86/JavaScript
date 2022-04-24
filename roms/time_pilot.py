#
#	Time Pilot
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg1 = z.read('tm1') + z.read('tm2') + z.read('tm3')
    prg2 = z.read('tm7')
    bg = z.read('tm6')
    obj = z.read('tm4')
    obj += z.read('tm5')
    rgb_h = z.read('timeplt.b4')
    rgb_l = z.read('timeplt.b5')
    objcolor = z.read('timeplt.e9')
    bgcolor = z.read('timeplt.e12')

rom = prg1 + prg2 + bg + obj + rgb_h + rgb_l + objcolor + bgcolor

def pngstring(a):
    w = 1024
    img = Image.new('L', (w, ceil(len(a) / w)))
    img.putdata(a)
    buf = BytesIO()
    img.save(buf, 'PNG')
    return b64encode(buf.getvalue())

with open(argv[2], 'wb') as f:
    f.write(b'export const ROM = \'data:image/png;base64,' + pngstring(rom) + b'\';\n')
