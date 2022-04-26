#
#	King & Balloon
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    voice = z.read('kingballj/kbj1.ic4') + z.read('kingballj/kbj2.ic5') + z.read('kingballj/kbj3.ic6')
    prg = z.read('prg1.7f') + z.read('prg2.7j') + z.read('prg3.7l')
    bg = z.read('chg1.1h') + z.read('chg2.1k')
    rgb = z.read('kb2-1')

rom = voice + prg + bg + rgb

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
