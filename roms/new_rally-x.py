#
#	New Rally-X
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg = z.read('nrx_prg1.1d')[:0x800] + z.read('nrx_prg2.1e')[:0x800] + z.read('nrx_prg1.1d')[0x800:0x1000] + z.read('nrx_prg2.1e')[0x800:0x1000]
    prg += z.read('nrx_prg3.1k')[:0x800] + z.read('nrx_prg4.1l')[:0x800] + z.read('nrx_prg3.1k')[0x800:0x1000] + z.read('nrx_prg4.1l')[0x800:0x1000]
    bgobj = z.read('nrx_chg1.8e') + z.read('nrx_chg2.8d')
    rgb = z.read('nrx1-1.11n')
    color = z.read('nrx1-7.8p')
    snd = z.read('rx1-5.3p')

rom = prg + bgobj + rgb + color + snd

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
