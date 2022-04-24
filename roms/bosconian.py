#
#	Bosconian
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg1 = z.read('bos3_1.3n') + z.read('bos1_2.3m') + z.read('bos1_3.3l') + z.read('bos1_4b.3k')
    prg2 = z.read('bos1_5c.3j') + z.read('bos3_6.3h')
    prg3 = z.read('bos1_7.3e')
    bg = z.read('bos1_14.5d')
    obj = z.read('bos1_13.5e')
    rgb = z.read('bos1-6.6b')
    bgcolor = z.read('bos1-5.4m')
    snd = z.read('bos1-1.1d')
    voi = z.read('bos1_9.5n') + z.read('bos1_10.5m') + z.read('bos1_11.5k')
with ZipFile(argv[2]) as z:
    key = z.read('50xx.bin')
with ZipFile(argv[3]) as z:
    io = z.read('51xx.bin')
with ZipFile(argv[4]) as z:
    prg = z.read('54xx.bin')

rom = prg1 + prg2 + prg3 + bg + obj + rgb + bgcolor + snd + voi + key + io + prg

def pngstring(a):
    w = 1024
    img = Image.new('L', (w, ceil(len(a) / w)))
    img.putdata(a)
    buf = BytesIO()
    img.save(buf, 'PNG')
    return b64encode(buf.getvalue())

with open(argv[5], 'wb') as f:
    f.write(b'export const ROM = \'data:image/png;base64,' + pngstring(rom) + b'\';\n')
