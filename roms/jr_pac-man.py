#
#	Jr. Pac-Man
#

from base64 import b64encode
from io import BytesIO
from math import ceil
from sys import argv
from zipfile import ZipFile
from PIL import Image

with ZipFile(argv[1]) as z:
    prg = z.read('jrp8d.8d') + z.read('jrp8e.8e') + z.read('jrp8h.8h') + z.read('jrp8j.8j') + z.read('jrp8k.8k')
    bg = z.read('jrp2c.2c')
    obj = z.read('jrp2e.2e')
    rgb_l = z.read('a290-27axv-bxhd.9e')
    rgb_h = z.read('a290-27axv-cxhd.9f')
    color = z.read('a290-27axv-axhd.9p')
    snd = z.read('a290-27axv-dxhd.7p')

rom = prg + bg + obj + rgb_l + rgb_h + color + snd

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
