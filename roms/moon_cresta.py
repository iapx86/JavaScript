#
#	Moon Cresta
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg = z.read('mc1') + z.read('mc2') + z.read('mc3') + z.read('mc4') + z.read('mc5.7r') + z.read('mc6.8d') + z.read('mc7.8e') + z.read('mc8')
    bg = z.read('mcs_b') + z.read('mcs_d') + z.read('mcs_a') + z.read('mcs_c')
    rgb = z.read('mmi6331.6l')

rom = prg + bg + rgb

def pngstring(a):
    w = 1024
    img = Image.new('L', (w, ceil(len(a) / w)))
    img.putdata(a)
    buf = BytesIO()
    img.save(buf, 'PNG')
    return b64encode(buf.getvalue())

with open(argv[2], 'wb') as f:
    f.write(b'export const ROM = \'data:image/png;base64,' + pngstring(rom) + b'\';\n')
