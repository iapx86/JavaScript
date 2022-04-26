#
#	Metro-Cross
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg1 = z.read('mc1-3.9c') + z.read('mc1-1.9a') + z.read('mc1-2.9b')
    prg2 = z.read('mc1-4.3b')
    prg2i = z.read('cus60-60a1.mcu')
    fg = z.read('mc1-5.3j')
    bg = z.read('mc1-7.4p') + z.read('mc1-6.4n') + b'\xff' * 0x4000
    obj = z.read('mc1-8.8k') + z.read('mc1-9.8l')
    green = z.read('mc1-1.1n')
    red = z.read('mc1-2.2m')

rom = prg1 + prg2 + prg2i + fg + bg + obj + green + red

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
