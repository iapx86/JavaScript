#
#	Saigo no Nindou
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    merge = lambda even, odd : bytes([odd[i // 2] if i % 2 else even[i // 2] for i in range(len(even) * 2)])
    prg = merge(z.read('nspiritj/nin_c-l0.6d') + z.read('nin_c-l1.6c') + z.read('nin_c-l2.6b') + z.read('nspiritj/nin_c-l3.6a'), z.read('nspiritj/nin_c-h0.6h') + z.read('nin_c-h1.6j') + z.read('nin_c-h2.6l') + z.read('nspiritj/nin_c-h3.6m'))

rom = prg

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
