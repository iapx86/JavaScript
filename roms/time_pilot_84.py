#
#	Time Pilot '84
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg1 = z.read('388_f04.7j') + z.read('388_05.8j') + z.read('388_f06.9j') + z.read('388_07.10j')
    prg2 = z.read('388_f08.10d')
    prg3 = z.read('388j13.6a')
    bg = z.read('388_h02.2j') + z.read('388_d01.1j')
    obj = z.read('388_e09.12a') + z.read('388_e10.13a') + z.read('388_e11.14a') + z.read('388_e12.15a')
    red = z.read('388d14.2c')
    green = z.read('388d15.2d')
    blue = z.read('388d16.1e')
    bgcolor = z.read('388d18.1f')
    objcolor = z.read('388j17.16c')

rom = prg1 + prg2 + prg3 + bg + obj + red + green + blue + objcolor + bgcolor

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
