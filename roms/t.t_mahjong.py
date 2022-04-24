#
#	T.T Mahjong
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg1 = z.read('ttmahjng/ju04') + z.read('j3') + z.read('ttmahjng/ju06') + z.read('ttmahjng/ju07')
    prg2 = z.read('ttmahjng/ju01') + z.read('ttmahjng/ju02') + z.read('ttmahjng/ju08')
    color1 = z.read('ju03')
    color2 = z.read('ju09')

rom = prg1 + prg2 + color1 + color2

def pngstring(a):
    w = 1024
    img = Image.new('L', (w, ceil(len(a) / w)))
    img.putdata(a)
    buf = BytesIO()
    img.save(buf, 'PNG')
    return b64encode(buf.getvalue())

with open(argv[2], 'wb') as f:
    f.write(b'export const ROM = \'data:image/png;base64,' + pngstring(rom) + b'\';\n')
