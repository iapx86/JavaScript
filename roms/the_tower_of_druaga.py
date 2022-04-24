#
#	The Tower of Druaga
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg1 = z.read('td2_3.1d') + z.read('td2_1.1b')
    prg2 = z.read('td1_4.1k')
    bg = z.read('td1_5.3b')
    obj = z.read('td1_7.3n') + z.read('td1_6.3m')
    rgb = z.read('td1-5.5b')
    bgcolor = z.read('td1-6.4c')
    objcolor = z.read('td1-7.5k')
    snd = z.read('td1-3.3m')

rom = prg1 + prg2 + bg + obj + rgb + bgcolor + objcolor + snd

def pngstring(a):
    w = 1024
    img = Image.new('L', (w, ceil(len(a) / w)))
    img.putdata(a)
    buf = BytesIO()
    img.save(buf, 'PNG')
    return b64encode(buf.getvalue())

with open(argv[2], 'wb') as f:
    f.write(b'export const ROM = \'data:image/png;base64,' + pngstring(rom) + b'\';\n')
