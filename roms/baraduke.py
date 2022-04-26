#
#	Baraduke
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg1 = z.read('bd1_3.9c') + z.read('baraduke/bd1_1.9a') + z.read('baraduke/bd1_2.9b')
    prg2 = z.read('baraduke/bd1_4b.3b')
    prg2i = z.read('cus60-60a1.mcu')
    fg = z.read('bd1_5.3j')
    bg = z.read('baraduke/bd1_8.4p') + z.read('bd1_7.4n') + z.read('baraduke/bd1_6.4m')
    obj = z.read('bd1_9.8k') + z.read('bd1_10.8l') + z.read('bd1_11.8m') + z.read('bd1_12.8n')
    green = z.read('bd1-1.1n')
    red = z.read('bd1-2.2m')

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
