#
#	Wonder Boy III
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    merge = lambda even, odd : bytes([odd[i // 2] if i % 2 else even[i // 2] for i in range(len(even) * 2)])
    prg1 = merge(z.read('wb31/epr-12084.bin') + z.read('wb31/epr-12085.bin'), z.read('wb31/epr-12082.bin') + z.read('wb31/epr-12083.bin'))
    key = z.read('wb31/317-0084.key')
    bg = z.read('wb31/epr-12086.bin') + z.read('wb31/epr-12087.bin') + z.read('wb31/epr-12088.bin')
    obj = merge(z.read('epr-12094.b5')[:0x8000] + z.read('epr-12095.b6')[:0x8000], z.read('epr-12090.b1')[:0x8000] + z.read('epr-12091.b2')[:0x8000])
    obj += merge(z.read('epr-12096.b7')[:0x8000] + z.read('epr-12097.b8')[:0x8000], z.read('epr-12092.b3')[:0x8000] + z.read('epr-12093.b4')[:0x8000])
    obj += merge(z.read('epr-12094.b5')[0x8000:] + z.read('epr-12095.b6')[0x8000:], z.read('epr-12090.b1')[0x8000:] + z.read('epr-12091.b2')[0x8000:])
    obj += merge(z.read('epr-12096.b7')[0x8000:] + z.read('epr-12097.b8')[0x8000:], z.read('epr-12092.b3')[0x8000:] + z.read('epr-12093.b4')[0x8000:])
    prg2 = z.read('wb31/epr-12089.bin')

rom = prg1 + key + bg + obj + prg2

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
