#
#	Pengo
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg = z.read('epr-1689c.ic8') + z.read('epr-1690b.ic7') + z.read('epr-1691b.ic15') + z.read('epr-1692b.ic14') + z.read('epr-1693b.ic21') + z.read('epr-1694b.ic20') + z.read('epr-5118b.ic32') + z.read('epr-5119c.ic31')
    bg = z.read('epr-1640.ic92')[:0x1000] + z.read('epr-1695.ic105')[:0x1000]
    obj = z.read('epr-1640.ic92')[0x1000:] + z.read('epr-1695.ic105')[0x1000:]
    rgb = z.read('pr1633.ic78')
    color = z.read('pr1634.ic88')
    snd = z.read('pr1635.ic51')

rom = prg + bg + obj + rgb + color + snd

def pngstring(a):
    w = 1024
    img = Image.new('L', (w, ceil(len(a) / w)))
    img.putdata(a)
    buf = BytesIO()
    img.save(buf, 'PNG')
    return b64encode(buf.getvalue())

with open(argv[2], 'wb') as f:
    f.write(b'export const ROM = \'data:image/png;base64,' + pngstring(rom) + b'\';\n')
