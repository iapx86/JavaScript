#
#	Galaxy Wars
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg1 = z.read('univgw3.0') + z.read('univgw4.1') + z.read('univgw5.2') + z.read('univgw6.3')
    prg2 = z.read('univgw1.4') + z.read('univgw2.5')
    map = z.read('01.1') + z.read('02.2')

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
