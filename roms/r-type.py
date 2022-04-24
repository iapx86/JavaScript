#
#	R-Type
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
    prg = merge(z.read('rtypej/rt_r-l0-.3b') + z.read('rtypej/rt_r-l1-.3c'), z.read('rtypej/rt_r-h0-.1b') + z.read('rtypej/rt_r-h1-.1c'))
    obj = z.read('rt_r-00.1h') + z.read('rt_r-01.1j') * 2 + z.read('rt_r-10.1k') + z.read('rt_r-11.1l') * 2 + z.read('rt_r-20.3h') + z.read('rt_r-21.3j') * 2 + z.read('rt_r-30.3k') + z.read('rt_r-31.3l') * 2
    bg1 = z.read('rt_b-a0.3c') + z.read('rt_b-a1.3d') + z.read('rt_b-a2.3a') + z.read('rt_b-a3.3e')
    bg2 = z.read('rt_b-b0.3j') + z.read('rt_b-b1.3k') + z.read('rt_b-b2.3h') + z.read('rt_b-b3.3f')

rom = prg + obj + bg1 + bg2

def pngstring(a):
    w = 1024
    img = Image.new('L', (w, ceil(len(a) / w)))
    img.putdata(a)
    buf = BytesIO()
    img.save(buf, 'PNG')
    return b64encode(buf.getvalue())

with open(argv[2], 'wb') as f:
    f.write(b'export const ROM = \'data:image/png;base64,' + pngstring(rom) + b'\';\n')
