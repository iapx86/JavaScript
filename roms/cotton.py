#
#	Cotton
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

def merge(even, odd):
    ret = bytearray(len(even) * 2)
    ret[0::2] = even
    ret[1::2] = odd
    return bytes(ret)

with ZipFile(argv[1]) as z:
    prg1 = merge(z.read('cottonj/epr-13858b.a7') + z.read('cottonj/epr-13859b.a8'), z.read('cottonj/epr-13856b.a5') + z.read('cottonj/epr-13857b.a6'))
    key = z.read('cottonj/317-0179b.key')
    bg = z.read('opr-13862.a14') + z.read('opr-13877.b14') + z.read('opr-13863.a15') + z.read('opr-13878.b15') + z.read('opr-13864.a16') + z.read('opr-13879.b16')
    obj = merge(z.read('opr-13869.b5') + z.read('opr-13870.b6') + z.read('opr-13871.b7') + z.read('opr-13872.b8'), z.read('opr-13865.b1') + z.read('opr-13866.b2') + z.read('opr-13867.b3') + z.read('opr-13868.b4'))
    obj += merge(z.read('opr-13873.b10') + z.read('opr-13874.b11') + z.read('cottonj/opr-13875.b12') + z.read('opr-13876.b13'), z.read('opr-13852.a1') + z.read('opr-13853.a2') + z.read('cottonj/opr-13854.a3') + z.read('opr-13855.a4'))
    prg2 = z.read('cottonj/epr-13860.a10') + z.read('cottonj/opr-13061.a11')

rom = prg1 + key + bg + obj + prg2

def pngstring(a):
    w = 1024
    img = Image.new('L', (w, ceil(len(a) / w)))
    img.putdata(a)
    buf = BytesIO()
    img.save(buf, 'PNG')
    return b64encode(buf.getvalue())

with open(argv[2], 'wb') as f:
    f.write(b'export const ROM = \'data:image/png;base64,' + pngstring(rom) + b'\';\n')
