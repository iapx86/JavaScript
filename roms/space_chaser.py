#
#	Space Chaser
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg1 = z.read('rt13.bin') + z.read('rt14.bin') + z.read('rt15.bin') + z.read('rt16.bin') + z.read('rt17.bin') + z.read('rt18.bin') + z.read('rt19.bin') + z.read('rt20.bin')
    prg2 = z.read('rt21.bin') + z.read('rt22.bin')
    map = z.read('rt06.ic2')

rom = prg1 + prg2 + map

def pngstring(a):
    w = 1024
    img = Image.new('L', (w, ceil(len(a) / w)))
    img.putdata(a)
    buf = BytesIO()
    img.save(buf, 'PNG')
    return b64encode(buf.getvalue())

with open(argv[2], 'wb') as f:
    f.write(b'export const ROM = \'data:image/png;base64,' + pngstring(rom) + b'\';\n')
