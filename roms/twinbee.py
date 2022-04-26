#
#	TwinBee
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    merge = lambda even, odd : bytes([odd[i // 2] if i % 2 else even[i // 2] for i in range(len(even) * 2)])
    prg1 = merge(z.read('400-a06.15l') + z.read('412-a07.17l'), z.read('400-a04.10l') + z.read('412-a05.12l'))
    prg2 = z.read('400-e03.5l')
    snd = z.read('400-a01.fse') + z.read('400-a02.fse')

rom = prg1 + prg2 + snd

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
