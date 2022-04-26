#
#	Mr. HELI no Daibouken
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    merge = lambda even, odd : bytes([odd[i // 2] if i % 2 else even[i // 2] for i in range(len(even) * 2)])
    prg = merge(z.read('mrheli/mh_c-l0-.ic37') + z.read('mrheli/mh_c-l1-.ic36') + z.read('mrheli/mh_c-l3-.ic34'), z.read('mrheli/mh_c-h0-.ic40') + z.read('mrheli/mh_c-h1-.ic41') + z.read('mrheli/mh_c-h3-.ic43'))

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
