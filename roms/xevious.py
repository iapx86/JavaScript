#
#	Xevious
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg1 = z.read('xvi_1.3p') + z.read('xvi_2.3m') + z.read('xvi_3.2m') + z.read('xvi_4.2l')
    prg2 = z.read('xvi_5.3f') + z.read('xvi_6.3j')
    prg3 = z.read('xvi_7.2c')
    bg2 = z.read('xvi_12.3b')
    bg4 = z.read('xvi_13.3c') + z.read('xvi_14.3d')
    obj = z.read('xvi_15.4m') + z.read('xvi_17.4p') + z.read('xvi_18.4r') + z.read('xvi_16.4n')
    maptbl = z.read('xvi_9.2a') + z.read('xvi_10.2b')
    mapdata = z.read('xvi_11.2c')
    red = z.read('xvi-8.6a')
    green = z.read('xvi-9.6d')
    blue = z.read('xvi-10.6e')
    bgcolor_l = z.read('xvi-7.4h')
    bgcolor_h = z.read('xvi-6.4f')
    objcolor_l = z.read('xvi-4.3l')
    objcolor_h = z.read('xvi-5.3m')
    snd = z.read('xvi-2.7n')
with ZipFile(argv[2]) as z:
    key = z.read('50xx.bin')
with ZipFile(argv[3]) as z:
    io = z.read('51xx.bin')
with ZipFile(argv[4]) as z:
    prg = z.read('54xx.bin')

rom = prg1 + prg2 + prg3 + bg2 + bg4 + obj + maptbl + mapdata + red + green + blue + bgcolor_l + bgcolor_h + objcolor_l + objcolor_h + snd + key + io + prg

def pngstring(a):
    w = 1024
    img = Image.new('P', (w, ceil(len(a) / w)))
    img.putpalette(sum([[i, 0, 0] for i in range(256)], []))
    img.putdata(a)
    buf = BytesIO()
    img.save(buf, 'PNG')
    return b64encode(buf.getvalue())

with open(argv[5], 'wb') as f:
    f.write(b'export const ROM = \'data:image/png;base64,' + pngstring(rom) + b'\';\n')
