#
#	Rally-X
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg = z.read('1b') + z.read('rallyxn.1e') + z.read('rallyxn.1h') + z.read('rallyxn.1k')
    bgobj = z.read('8e')
    rgb = z.read('rx1-1.11n')
    color = z.read('rx1-7.8p')
    snd = z.read('rx1-5.3p')

rom = prg + bgobj + rgb + color + snd

def pngstring(a):
    w = 1024
    img = Image.new('L', (w, ceil(len(a) / w)))
    img.putdata(a)
    buf = BytesIO()
    img.save(buf, 'PNG')
    return b64encode(buf.getvalue())

with open(argv[2], 'wb') as f:
    f.write(b'export const ROM = \'data:image/png;base64,' + pngstring(rom) + b'\';\n')
