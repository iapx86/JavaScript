#
#	DigDug
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg1 = z.read('dd1a.1') + z.read('dd1a.2') + z.read('dd1a.3') + z.read('dd1a.4')
    prg2 = z.read('dd1a.5') + z.read('dd1a.6')
    prg3 = z.read('dd1.7')
    bg2 = z.read('dd1.9')
    obj = z.read('dd1.15') + z.read('dd1.14') + z.read('dd1.13') + z.read('dd1.12')
    bg4 = z.read('dd1.11')
    mapdata = z.read('dd1.10b')
    rgb = z.read('136007.113')
    objcolor = z.read('136007.111')
    bgcolor = z.read('136007.112')
    snd = z.read('136007.110')
with ZipFile(argv[2]) as z:
    io = z.read('51xx.bin')

rom = prg1 + prg2 + prg3 + bg2 + obj + bg4 + mapdata + rgb + objcolor + bgcolor + snd + io

def pngstring(a):
    w = 1024
    img = Image.new('P', (w, ceil(len(a) / w)))
    img.putpalette(sum([[i, 0, 0] for i in range(256)], []))
    img.putdata(a)
    buf = BytesIO()
    img.save(buf, 'PNG')
    return b64encode(buf.getvalue())

with open(argv[3], 'wb') as f:
    f.write(b'export const ROM = \'data:image/png;base64,' + pngstring(rom) + b'\';\n')
