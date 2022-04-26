﻿#
#	Fantasy Zone
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    merge = lambda even, odd : bytes([odd[i // 2] if i % 2 else even[i // 2] for i in range(len(even) * 2)])
    prg1 = merge(z.read('epr-7385a.43') + z.read('epr-7386a.42') + z.read('epr-7387.41'), z.read('epr-7382a.26') + z.read('epr-7383a.25') + z.read('epr-7384.24'))
    bg = z.read('epr-7388.95') + z.read('epr-7389.94') + z.read('epr-7390.93')
    obj = merge(z.read('epr-7396.11') + z.read('epr-7397.18') + z.read('epr-7398.24'), z.read('epr-7392.10') + z.read('epr-7393.17') + z.read('epr-7394.23'))
    prg2 = z.read('epr-7535a.12')

rom = prg1 + bg + obj + prg2

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
